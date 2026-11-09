# HR Management System — API Contract

Status: **v3.0 (minimal)** — based on `REQUIREMENTS.md` and `DATABASE.md` v3.0. **9 endpoints.**

The agreement between the backend (PHP) and the frontend (React). If the backend returns exactly what is
written here, the frontend works.

## 1. Conventions

- Base URL: `http://hr.localhost/api/v1`
- Send `Content-Type: application/json` with a body, and `Authorization: Bearer <token>` on every endpoint
  except login.
- Field names are `snake_case`. Dates `YYYY-MM-DD`, date-times `YYYY-MM-DD HH:MM:SS`. Empty values are `null`.
- The React dev server forwards `/api/*` to `hr.localhost`, so the backend needs **no CORS code**.

**Success:** `{ "data": … }`. Paginated lists add `"meta": { "page": 1, "per_page": 20, "total": 57, "total_pages": 3 }`
and accept `?page=` and `?per_page=` (default 20, max 100).

**Errors** always look like this (`details` only for validation errors):

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "The given data was invalid.",
             "details": { "email": ["The email field is required."] } } }
```

| HTTP | `code` | When |
|---|---|---|
| 400 | `BAD_REQUEST` | body is not valid JSON |
| 401 | `UNAUTHENTICATED` | missing/invalid/expired token, wrong email or password |
| 403 | `FORBIDDEN` | logged in, but not allowed (role, or reviewing your own leave) |
| 404 | `NOT_FOUND` | unknown route or record |
| 409 | `CONFLICT` | duplicate code/email, or an action the current status doesn't allow |
| 422 | `VALIDATION_ERROR` | invalid fields (see `details`) |
| 422 | `INSUFFICIENT_BALANCE` | not enough leave days left |
| 422 | `OVERLAPPING_REQUEST` | dates overlap another pending/approved request |
| 500 | `SERVER_ERROR` | anything unexpected — never show PHP errors or SQL |

## 2. Endpoints

| # | Method | Path | Who | Purpose |
|---|---|---|---|---|
| 1 | POST | `/auth/login` | public | Log in, get a token |
| 2 | GET | `/me` | all | My profile + leave balances |
| 3 | GET | `/employees` | HR | List / search employees |
| 4 | POST | `/employees` | HR | Add an employee (and their login) |
| 5 | PATCH | `/employees/{id}` | HR | Edit, reset password, or terminate |
| 6 | GET | `/leave-requests` | all | Employees: their own. HR: everyone's |
| 7 | POST | `/leave-requests` | all | Request leave |
| 8 | PATCH | `/leave-requests/{id}` | all | HR approves/rejects; the owner cancels |
| 9 | GET | `/holidays` | all | Public holidays of a year |

## 3. Objects

**Employee** (`password_hash` is never returned):

```json
{
  "id": 5, "employee_code": "EMP-0005", "first_name": "Sara", "last_name": "Ali", "full_name": "Sara Ali",
  "email": "sara.ali@company.test", "phone": "+1 555 0105", "job_title": "Backend Developer",
  "department": "Engineering", "hire_date": "2024-02-01", "status": "active", "termination_date": null,
  "role": "employee", "last_login_at": "2026-11-09 08:58:02"
}
```

**Leave balance** — one per leave type, including the type's rules (so the frontend can explain them):

```json
{ "type": "annual", "name": "Annual", "year": 2026, "days_per_year": 21, "used_days": 3,
  "remaining_days": 18, "min_notice_days": 3, "max_backdate_days": 0 }
```

| `type` | `name` | `days_per_year` | `min_notice_days` (working days ahead) | `max_backdate_days` (days in the past) |
|---|---|---|---|---|
| `annual` | Annual | 21 | 3 | 0 |
| `sick` | Sick | 10 | 0 | 7 |

**Leave request:**

```json
{
  "id": 88, "employee": { "id": 5, "employee_code": "EMP-0005", "full_name": "Sara Ali" },
  "type": "annual", "start_date": "2026-11-23", "end_date": "2026-11-27", "days": 4,
  "reason": "Family trip", "status": "pending", "reviewer": null, "review_comment": null,
  "reviewed_at": null, "created_at": "2026-11-09 11:02:45"
}
```

`reviewer` has the same shape as `employee`. `days` excludes weekends and public holidays.

**Holiday:** `{ "id": 3, "holiday_date": "2026-11-26", "name": "Thanksgiving Day" }`

## 4. Endpoint details

### 1. `POST /auth/login`

Body `{ "email": "…", "password": "…" }` → `200`:

```json
{ "data": { "token": "64 hex characters", "expires_at": "2026-11-09 17:00:00", "user": { "…": "Employee" } } }
```

`422` if a field is missing. `401` for a wrong email, wrong password **or** a terminated employee — always the
same message ("Invalid email or password."), so nobody can find out which emails exist.

### 2. `GET /me`

```json
{ "data": { "user": { "…": "Employee" }, "leave_balances": [ { "…": "annual" }, { "…": "sick" } ] } }
```

Balances are for the current year. The frontend calls this on page load to restore the session.

### 3. `GET /employees` (HR)

Query: `search` (name, code or email), `status` (`active` default, `terminated`, `all`), `page`, `per_page`.
Sorted by last name. Paginated list of Employee objects.

### 4. `POST /employees` (HR)

```json
{ "employee_code": "EMP-0057", "first_name": "Lina", "last_name": "Kamal", "email": "lina@company.test",
  "phone": null, "job_title": "Frontend Developer", "department": "Engineering", "hire_date": "2026-11-10",
  "role": "employee", "password": "initial-password" }
```

`201` with the Employee. `422` for missing/invalid fields (`role` is `hr` or `employee`, `password` ≥ 8
characters). `409` if `employee_code` or `email` already exists.

### 5. `PATCH /employees/{id}` (HR)

Send only the fields to change — any field of `POST` except `employee_code`. Also:

- `password` — resets the password.
- `status: "terminated"` **with** `termination_date` (≥ hire date) — terminates the employee: deletes their
  tokens and cancels their `pending` leave and `approved` leave starting after the termination date
  (`review_comment`: "Cancelled automatically: employee terminated."). Do all of it in **one transaction**.

`200` with the Employee. Errors: `404` unknown id · `422` invalid fields · `409` duplicate email, changing your
own role, terminating yourself, or changing the status of an already terminated employee.

### 6. `GET /leave-requests`

Query: `status`, `from` & `to` (requests touching that date range), `employee_id` (HR only), `page`, `per_page`.

- **Employee:** always only their own requests (`employee_id` is ignored). Newest first.
- **HR:** everyone's. With `status=pending`, oldest first (the queue to work through); otherwise newest first.

### 7. `POST /leave-requests`

Body `{ "type": "annual", "start_date": "2026-11-23", "end_date": "2026-11-27", "reason": "Family trip" }`
→ `201` with the Leave request (`status: "pending"`, `days` calculated by the server).

Check in this order:

1. `422 VALIDATION_ERROR` — `type` not `annual`/`sick`, dates missing or invalid.
2. `422` on `start_date` — planned type (`annual`) starting less than 3 working days ahead:
   *"Annual leave must be requested at least 3 working days ahead (from 2026-11-12)."*
3. `422` on `start_date` — starting further back than allowed: *"Sick leave can start at most 7 days in the
   past."* / *"The start date cannot be in the past."*
4. `422` on `end_date` — before the start, in a different year, or no working days in the range.
5. `422 OVERLAPPING_REQUEST` — overlaps the employee's pending or approved leave.
6. `422 INSUFFICIENT_BALANCE` — more days than remain for that type and year.

### 8. `PATCH /leave-requests/{id}`

Body `{ "status": "approved" | "rejected" | "cancelled", "comment": "…" }` → `200` with the Leave request.

| New status | Who | Allowed when | Extra |
|---|---|---|---|
| `approved` | HR, not for their own request | status is `pending` | balance checked again (`422 INSUFFICIENT_BALANCE`); `comment` optional |
| `rejected` | HR, not for their own request | status is `pending` | `comment` **required** (422) |
| `cancelled` | the owner | `pending`, or `approved` and `start_date` after today | days come back automatically |

Errors: `404` unknown id, or an employee touching someone else's request · `403` HR reviewing their own
request, or an employee approving/rejecting · `409` the current status doesn't allow it (e.g. leave already
started) · `422` invalid `status`.

### 9. `GET /holidays`

Query: `year` (default: current year). List (not paginated) of Holiday objects, sorted by date.

## 5. Build order

| Phase | Endpoints | Tables |
|---|---|---|
| 0 Foundation | — (a health check is optional) | — |
| 1 Login | #1, #2 | `employees`, `auth_tokens` |
| 2 Employees | #3, #4, #5 | — |
| 3 Holidays | #9 | `public_holidays` |
| 4 Leave | #6, #7, #8 | `leave_requests` |
