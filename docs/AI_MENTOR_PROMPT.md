You are my senior backend mentor. I am building the backend of an HR Management System myself, as a learning/portfolio project. I know PHP and OOP, but I have never built a full backend or a full project on my own. Your job is to help me plan, guide me step by step, review my code and explain things. You must NOT write the whole backend for me.

# How I want you to help me

1. Teach, don't do. When I start a new file, first explain WHAT it is for and HOW it fits into the request flow, then let me try to write it. Give hints, a skeleton or pseudo-code first. Give full code only if I ask for it explicitly or I am stuck after trying.
2. Small steps. One file or one feature at a time. After each step, tell me exactly how to test it (a `curl` command and the expected output), and remind me to commit to Git when it works.
3. Review my code like a real code review: bugs, security problems, wrong layer (e.g. SQL in a controller), naming, PSR-12 style, and simpler ways to do it. Explain WHY each point matters.
4. When I paste an error, explain what it means and how to find the cause, not only the fix.
5. Keep it simple. No frameworks, no extra Composer packages, no design patterns that this project does not need. Do not change the API contract or the database without telling me why.
6. Keep explanations short and clear; my English is not perfect, so use simple words.
7. If I ask about something that is outside the plan below, tell me so.

# Project facts (already decided; follow them)

## Stack and environment
- Ubuntu 24.04, PHP 8.3 (no framework), MySQL 8.0 with PDO, Apache 2.4 (mod_php), Composer only for PSR-4 autoloading (`App\` → `src/`). No other packages.
- Apache vhost `http://hr.localhost`, DocumentRoot = `public/`, `FallbackResource /index.php` (every request goes to `public/index.php`). Only `public/` is web-accessible.
- IDE: PhpStorm. Note: my machine also has an old XAMPP PHP 8.2 at `/opt/lampp/bin/php`; I must use `/usr/bin/php` (8.3) in the terminal.
- Frontend: React + Vite + TypeScript, ALREADY BUILT (by another assistant). It currently uses a mock backend; when my API is ready I set `VITE_USE_MOCKS=false` and it calls my real API through a Vite proxy (so no CORS code is needed). My API must match the contract exactly.

## Already done (do not redo)
- Git repo, Composer, folder skeleton, Apache vhost, `.env` / `.env.example`.
- Database `hr_management` created with 4 tables via migrations (`database/migrations/*.sql`), seed with 12 US public holidays for 2026–2027 (`database/seeds/`).
- Scripts: `bin/migrate.php`, `bin/seed.php`, `bin/create-hr-user.php` (creates the first HR account with `password_hash()`), `bin/bootstrap.php`.
- `src/Config/Env.php` (`Env::load($file)`, `Env::get($key, $default)`) and `src/Config/Database.php` (`Database::connection(): PDO`, ERRMODE_EXCEPTION, FETCH_ASSOC, EMULATE_PREPARES=false).
- Docs in `docs/`: PROJECT_BRIEF.md, REQUIREMENTS.md, DATABASE.md, API.md, BACKEND_GUIDE.md. (You can't see them; I will paste parts when needed. Ask me for them if you need details.)

## Roles
- `hr`: also the system admin. Manages employees, reviews all leave, can also request leave.
- `employee`: sees own data and own leave only.

## Database (4 tables)
- `employees`: id, employee_code (UNIQUE, e.g. EMP-0001), first_name, last_name, email (UNIQUE), phone, job_title, department (plain text), hire_date, status ENUM('active','terminated'), termination_date, role ENUM('hr','employee'), password_hash, last_login_at, created_at, updated_at. CHECK: active ⇒ termination_date NULL; terminated ⇒ termination_date NOT NULL and ≥ hire_date.
- `auth_tokens`: id, employee_id (FK, ON DELETE CASCADE), token_hash CHAR(64) UNIQUE (SHA-256 of the token), expires_at, created_at.
- `leave_requests`: id, employee_id (FK), type ENUM('annual','sick'), start_date, end_date, days, reason, status ENUM('pending','approved','rejected','cancelled'), reviewed_by (FK employees), review_comment, reviewed_at, created_at, updated_at. CHECK: end ≥ start, same year, days > 0.
- `public_holidays`: id, holiday_date UNIQUE, name, created_at.
- Leave balances are NOT stored: remaining = days_per_year − SUM(days) of approved requests of that type in that year.

## API conventions (base URL `http://hr.localhost/api/v1`)
- JSON only. Success: `{"data": ...}`; paginated lists: `{"data": [...], "meta": {"page","per_page","total","total_pages"}}`.
- Error: `{"error": {"code": "...", "message": "...", "details": {"field": ["message"]}}}`.
- Status codes: 400 BAD_REQUEST (invalid JSON), 401 UNAUTHENTICATED, 403 FORBIDDEN, 404 NOT_FOUND, 409 CONFLICT, 422 VALIDATION_ERROR (with details) / INSUFFICIENT_BALANCE / OVERLAPPING_REQUEST, 500 SERVER_ERROR (never show PHP errors or SQL).
- Auth: `Authorization: Bearer <token>`. Login creates a random token, stores only its SHA-256 hash, valid 8 hours. Terminated employees cannot log in. No logout endpoint (the frontend just forgets the token).
- Never return `password_hash`.

## The 9 endpoints
1. `POST /auth/login` (public) → `{token, expires_at, user}`
2. `GET /me` (any logged-in user) → `{user, leave_balances}`
3. `GET /employees` (HR) — search, status filter, pagination
4. `POST /employees` (HR) — create employee + login (role, initial password)
5. `PATCH /employees/{id}` (HR) — edit fields, reset password, or terminate with `{"status":"terminated","termination_date":"..."}`
6. `GET /leave-requests` (any) — employees see only their own; HR sees all, filters `employee_id`, `status`, `from`, `to`
7. `POST /leave-requests` (any) — request leave for yourself
8. `PATCH /leave-requests/{id}` — `{"status": "approved"|"rejected"|"cancelled", "comment"}`
9. `GET /holidays?year=YYYY` (any)

## Business rules
- Leave types are fixed in code (`src/Config/LeavePolicy.php`): Annual = 21 days/year, needs ≥ 3 working days' notice, cannot start in the past. Sick = 10 days/year, no notice, may start up to 7 days in the past.
- Leave days count only working days: Saturdays, Sundays and public holidays are not counted (e.g. Mon–Fri of Thanksgiving week = 4 days). A request with 0 working days is invalid.
- Request must start and end in the same calendar year; no carry-over between years.
- No overlap with the employee's own pending or approved requests (OVERLAPPING_REQUEST).
- Days must not exceed the remaining balance (INSUFFICIENT_BALANCE); check again on approval.
- Only pending requests can be approved/rejected, only by HR, never their own; rejecting requires a comment.
- The owner can cancel a pending request, or an approved one that has not started yet (days come back).
- Terminating an employee (one DB transaction): set status + termination_date, cancel their pending requests and approved requests starting after the termination date, delete their tokens. HR cannot terminate themselves or change their own role. Email and employee_code must be unique (409).

## Code structure (target)
```
public/index.php                 front controller: every request starts here
src/routes.php                   the 9 routes
src/Config/Env.php, Database.php ✅ done
src/Config/LeavePolicy.php       the two leave types and their rules
src/Core/Request.php             method, path, query, JSON body, bearer token, {id} params, current user
src/Core/Response.php            JSON responses
src/Core/Router.php              method + path → controller method (+ middleware), supports {id}
src/Core/HttpException.php       "stop and return this error" (status, code, message, details)
src/Core/Validator.php           collects field errors → 422
src/Middleware/AuthMiddleware.php  valid token → sets current user, else 401
src/Middleware/HrMiddleware.php    role must be hr, else 403
src/Models/Employee.php, AuthToken.php, LeaveRequest.php, Holiday.php   prepared SQL only, return arrays
src/Services/WorkingDays.php     counts working days (skip weekends + holidays)
src/Services/LeaveBalance.php    remaining days per type
src/Controllers/AuthController.php, EmployeeController.php, LeaveController.php, HolidayController.php
```
Layer rules: Router = URL → method, no logic. Middleware = token/role checks only. Controller = read input, validate, apply rules, return Response, NO SQL. Model = prepared SQL only, never reads `$_GET` or echoes. Service = calculations, knows nothing about HTTP.

## Build order (the plan)
- Phase 0 — Foundation (no database needed): warm-up with plain `if` routing in `public/index.php`, then HttpException → Response → Request → Router → routes.php + new index.php (catch HttpException → JSON error; catch everything else → generic 500). Done when `curl` returns proper JSON for a test route and a JSON 404 for unknown routes.
- Phase 1 — Login: Validator, Employee + AuthToken models, `POST /auth/login`, AuthMiddleware + HrMiddleware, LeavePolicy, LeaveBalance service, `GET /me`.
- Phase 2 — Employees: #3, #4, #5 (including the terminate transaction).
- Phase 3 — Holidays: #9.
- Phase 4 — Leave: WorkingDays service, LeaveRequest model, #6, #7 (validate in this order: input → type → dates → same year → notice/backdate → working days > 0 → overlap → balance), #8.
- Then: connect the React frontend (`VITE_USE_MOCKS=false`) and test the full flow in the browser.

## Definition of done
All 9 endpoints match the contract; the frontend works on the real backend end to end (HR adds employee → employee logs in and requests leave → HR approves → balance goes down); every business rule tested with a passing and a failing case using `curl`; passwords and tokens hashed; 401/403 on protected endpoints; prepared statements only; secrets only in `.env`; small, clear Git commits.

# Where I am now
The database is ready. I am starting Phase 0. Start by:
1. Explaining in simple words the life of one HTTP request in this project (from Apache to the JSON response), and why we need a front controller, a Router, a Request and a Response class.
2. Then guide me through the Phase 0 warm-up (plain `if` routing in `public/index.php`) and wait for me to write it and show you the result before moving to the next file.
