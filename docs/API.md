# HR Management System — API Contract

Status: **Draft v0.1** — based on `REQUIREMENTS.md` v1.0 and `DATABASE.md`.

This document is the agreement between the backend (PHP) and the frontend (React).
If the backend returns exactly what is written here, the frontend works. If something needs
to change, change this document first, then both sides.

## 1. Conventions

### Base URL & headers

```
http://hr.localhost/api/v1
```

| Header | Value | When |
|---|---|---|
| `Content-Type` | `application/json` | requests with a body |
| `Accept` | `application/json` | always |
| `Authorization` | `Bearer <token>` | every endpoint except `POST /auth/login` and `GET /health` |

During development the React app (Vite, `localhost:5173`) forwards `/api/*` to `http://hr.localhost`
through Vite's proxy, so the browser sees one origin and **the backend needs no CORS code**.

### Data formats

| Type | Format | Example |
|---|---|---|
| IDs | integer | `12` |
| Field names | `snake_case`, same as the database | `first_name` |
| Date | `YYYY-MM-DD` | `"2026-11-04"` |
| Date-time | `YYYY-MM-DD HH:MM:SS`, company timezone | `"2026-11-04 09:12:30"` |
| Money (USD) | **string** with 2 decimals | `"1500.00"` |
| Booleans | `true` / `false` (not `1`/`0`) | `"is_active": true` |
| Empty value | `null` (not `""`) | `"phone": null` |

> Money is a string because PDO returns `DECIMAL` columns as strings, and JSON numbers can lose
> cents to floating-point rounding. The frontend only formats it for display.

### Success responses

Single item:

```json
{ "data": { "id": 3, "name": "Engineering" } }
```

List (paginated):

```json
{
  "data": [ { "id": 3, "name": "Engineering" } ],
  "meta": { "page": 1, "per_page": 20, "total": 57, "total_pages": 3 }
}
```

Action with nothing to return (logout, delete): `204 No Content`, empty body.

### Error responses

Every error has the same shape, so the frontend can handle all of them in one place:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "The given data was invalid.",
    "details": {
      "email": ["The email field is required."],
      "end_date": ["The end date must be on or after the start date."]
    }
  }
}
```

`details` is present only for `VALIDATION_ERROR`; it maps field names to messages so the form
can show each message under its field.

| HTTP | `code` | When |
|---|---|---|
| 400 | `BAD_REQUEST` | body is not valid JSON |
| 401 | `UNAUTHENTICATED` | missing, invalid or expired token; wrong email/password |
| 403 | `FORBIDDEN` | logged in, but the role isn't allowed |
| 404 | `NOT_FOUND` | unknown route or record — also used when a manager asks for an employee outside their team |
| 409 | `CONFLICT` | duplicate value, record in use, or action not allowed in the current status |
| 422 | `VALIDATION_ERROR` | invalid fields (see `details`) |
| 422 | `INSUFFICIENT_BALANCE` | leave request exceeds remaining days |
| 422 | `OVERLAPPING_REQUEST` | leave dates overlap another pending/approved request |
| 500 | `SERVER_ERROR` | unexpected error — never expose PHP messages or SQL |

### Pagination, search & filters

List endpoints accept `?page=1&per_page=20` (default 20, max 100) plus the filters listed per endpoint.
Unknown query parameters are ignored.

### Roles in this document

`A` = admin, `H` = hr, `M` = manager, `E` = employee, `all` = any logged-in user.
"team" = employees whose `manager_id` is the current user's employee.

## 2. Endpoints overview

| Method | Path | Roles | Req. |
|---|---|---|---|
| **Health** ||||
| GET | `/health` | public | — |
| **Auth** ||||
| POST | `/auth/login` | public | AUTH-1 |
| POST | `/auth/logout` | all | AUTH-3 |
| GET | `/auth/me` | all | — |
| PUT | `/auth/password` | all | AUTH-3 |
| **Self-service (`/me`)** ||||
| GET | `/me` | all | EMP-5 |
| PATCH | `/me` | all | EMP-2 |
| GET | `/me/leave-balances` | all | LEAVE-2 |
| GET | `/me/leave-requests` | all | LEAVE-9 |
| GET | `/me/attendance/today` | all | ATT-1 |
| GET | `/me/attendance` | all | ATT-6 |
| GET | `/me/payslips` | all | PAY-6 |
| **Users** ||||
| GET | `/users` | A | AUTH-4 |
| POST | `/users` | A | AUTH-4 |
| PATCH | `/users/{id}` | A | AUTH-4, AUTH-5 |
| **Departments** ||||
| GET | `/departments` | all | ORG-1 |
| GET | `/departments/{id}` | all | ORG-1 |
| POST | `/departments` | A H | ORG-1 |
| PATCH | `/departments/{id}` | A H | ORG-1 |
| DELETE | `/departments/{id}` | A H | ORG-3 |
| **Positions** ||||
| GET | `/positions` | all | ORG-2 |
| POST | `/positions` | A H | ORG-2 |
| PATCH | `/positions/{id}` | A H | ORG-2 |
| DELETE | `/positions/{id}` | A H | ORG-3 |
| **Employees** ||||
| GET | `/employees` | A H, M (team) | EMP-4 |
| GET | `/employees/{id}` | A H, M (team) | EMP-5 |
| POST | `/employees` | A H | EMP-1 |
| PATCH | `/employees/{id}` | A H | EMP-2 |
| POST | `/employees/{id}/terminate` | A H | EMP-3 |
| **Leave** ||||
| GET | `/leave-types` | all | LEAVE-1 |
| POST | `/leave-types` | A H | LEAVE-1 |
| PATCH | `/leave-types/{id}` | A H | LEAVE-1 |
| GET | `/leave-balances` | A H, M (team) | LEAVE-2 |
| PATCH | `/leave-balances/{id}` | A H | LEAVE-2 |
| POST | `/leave-balances/generate` | A H | LEAVE-10 |
| GET | `/leave-requests` | A H, M (team) | LEAVE-9 |
| GET | `/leave-requests/{id}` | A H, M (team), owner | LEAVE-9 |
| POST | `/leave-requests` | all | LEAVE-3–5 |
| POST | `/leave-requests/{id}/approve` | A H, M (team) | LEAVE-7–8 |
| POST | `/leave-requests/{id}/reject` | A H, M (team) | LEAVE-7 |
| POST | `/leave-requests/{id}/cancel` | owner | LEAVE-6 |
| **Attendance** ||||
| POST | `/attendance/check-in` | all | ATT-1, ATT-3 |
| POST | `/attendance/check-out` | all | ATT-1 |
| GET | `/attendance` | A H, M (team) | ATT-5 |
| GET | `/attendance/report` | A H, M (team) | ATT-6 |
| POST | `/attendance` | A H | ATT-5 |
| PATCH | `/attendance/{id}` | A H | ATT-5 |
| **Payroll** ||||
| GET | `/employees/{id}/salary-components` | A H | PAY-2 |
| POST | `/employees/{id}/salary-components` | A H | PAY-2 |
| PATCH | `/salary-components/{id}` | A H | PAY-2 |
| GET | `/payroll-runs` | A H | PAY-5 |
| GET | `/payroll-runs/{id}` | A H | PAY-5 |
| POST | `/payroll-runs` | A H | PAY-3 |
| POST | `/payroll-runs/{id}/recalculate` | A H | PAY-5 |
| POST | `/payroll-runs/{id}/finalize` | A H | PAY-5 |
| DELETE | `/payroll-runs/{id}` | A H | PAY-5 |
| GET | `/payslips/{id}` | A H, owner | PAY-6 |
| **Settings & dashboard** ||||
| GET | `/settings` | all | ATT-3 |
| PATCH | `/settings` | A | ATT-3 |
| GET | `/dashboard` | all | DASH-1–3 |

> **Why `POST /leave-requests/{id}/approve` instead of `PATCH` with `status`?** Approving is an
> *action* with its own rules (permission, balance update, transaction), not a field edit. A separate
> endpoint per action keeps each rule in one place and makes permission checks simple.

## 3. Shared objects

These shapes are reused across endpoints. "Summary" objects are small versions embedded in others.

### Employee summary

```json
{ "id": 12, "employee_code": "EMP-0012", "full_name": "Sara Ali" }
```

### Employee

```json
{
  "id": 12,
  "employee_code": "EMP-0012",
  "first_name": "Sara",
  "last_name": "Ali",
  "full_name": "Sara Ali",
  "email": "sara.ali@company.test",
  "phone": "+1 555 0100",
  "date_of_birth": "1994-05-17",
  "gender": "female",
  "national_id": "A1234567",
  "address": "12 Main St, Springfield",
  "department": { "id": 3, "name": "Engineering" },
  "position": { "id": 7, "title": "Backend Developer" },
  "manager": { "id": 4, "employee_code": "EMP-0004", "full_name": "Omar Hassan" },
  "employment_type": "full_time",
  "base_salary": "3200.00",
  "hire_date": "2024-02-01",
  "status": "active",
  "termination_date": null,
  "created_at": "2024-01-28 10:15:00",
  "updated_at": "2026-10-02 14:40:11"
}
```

`base_salary`, `national_id` and `date_of_birth` are returned only to A/H and to the employee
themself (`/me`). Managers receive the object without these three fields.

### User

```json
{
  "id": 5,
  "role": "manager",
  "is_active": true,
  "last_login_at": "2026-11-04 08:58:02",
  "employee": { "id": 4, "employee_code": "EMP-0004", "full_name": "Omar Hassan", "email": "omar@company.test" }
}
```

### Leave request

```json
{
  "id": 88,
  "employee": { "id": 12, "employee_code": "EMP-0012", "full_name": "Sara Ali" },
  "leave_type": { "id": 1, "name": "Annual", "is_paid": true },
  "start_date": "2026-11-16",
  "end_date": "2026-11-20",
  "days": 5,
  "reason": "Family trip",
  "status": "pending",
  "reviewer": null,
  "review_comment": null,
  "reviewed_at": null,
  "created_at": "2026-11-04 11:02:45"
}
```

### Attendance record

```json
{
  "id": 501,
  "employee": { "id": 12, "employee_code": "EMP-0012", "full_name": "Sara Ali" },
  "work_date": "2026-11-04",
  "check_in_at": "2026-11-04 09:21:10",
  "check_out_at": null,
  "status": "late",
  "worked_minutes": null,
  "correction": null
}
```

`worked_minutes` is calculated (null until check-out). `correction`, when present:
`{ "by": <employee summary>, "reason": "Forgot to check out", "at": "2026-11-05 10:00:00" }`.

## 4. Endpoint details

Only endpoints with non-obvious input/output are shown in full. Unless stated otherwise:
`GET /things` returns a paginated list of the object, `GET /things/{id}` returns one object,
`POST` returns `201` with the created object, `PATCH` accepts any subset of the create fields
and returns `200` with the updated object.

### 4.1 Health

`GET /health` → `200`

```json
{ "data": { "status": "ok" } }
```

### 4.2 Auth

#### `POST /auth/login`

```json
{ "email": "sara.ali@company.test", "password": "secret-password" }
```

`200`:

```json
{
  "data": {
    "token": "9f2c4e…64 hex chars…",
    "expires_at": "2026-11-04 17:00:00",
    "user": { "…": "User object (see 3)" }
  }
}
```

Errors: `422` missing fields · `401 UNAUTHENTICATED` wrong email/password **or** inactive account
(same message for all three, so attackers can't tell which emails exist).

#### `POST /auth/logout` → `204`
Deletes the current token.

#### `GET /auth/me` → `200` with the User object. The frontend calls this on page load to restore the session.

#### `PUT /auth/password`

```json
{ "current_password": "old-one", "new_password": "new-one-min-8-chars" }
```

`204`. Errors: `422` if `current_password` is wrong or `new_password` is shorter than 8 characters.

### 4.3 Self-service

| Endpoint | Returns |
|---|---|
| `GET /me` | Employee object of the logged-in user |
| `PATCH /me` | Body: only `phone`, `address` (other fields are ignored). Returns Employee. |
| `GET /me/leave-balances?year=2026` | List (not paginated), see 4.7 |
| `GET /me/leave-requests?status=pending` | Paginated list of Leave request |
| `GET /me/attendance/today` | Attendance record or `{ "data": null }` if not checked in |
| `GET /me/attendance?month=2026-11` | Monthly report, same shape as `/attendance/report` (4.8) |
| `GET /me/payslips?year=2026` | Paginated list of **finalized** payslips (summary, no items) |

### 4.4 Users (admin)

`GET /users?role=manager&is_active=true&search=omar` → paginated User list.

`POST /users`

```json
{ "employee_id": 4, "role": "manager", "password": "initial-password" }
```

Errors: `409 CONFLICT` if the employee already has an account · `422` unknown employee or role.

`PATCH /users/{id}` — any of `role`, `is_active`, `password` (admin resets a password).
Setting `is_active: false` also deletes the user's tokens (logs them out). An admin can't deactivate
or change the role of their own account (`409`).

### 4.5 Departments & positions

Department object:

```json
{
  "id": 3,
  "name": "Engineering",
  "description": "Product development",
  "head": { "id": 4, "employee_code": "EMP-0004", "full_name": "Omar Hassan" },
  "employee_count": 18,
  "created_at": "2024-01-10 09:00:00"
}
```

- `GET /departments?search=eng` — paginated. `?all=true` returns every department without
  pagination (for dropdowns).
- `POST /departments` — `{ "name", "description"?, "head_employee_id"? }`. `409` duplicate name.
- `DELETE /departments/{id}` — `204`, or `409 CONFLICT` if it still has employees or positions.

Position object:

```json
{
  "id": 7,
  "title": "Backend Developer",
  "department": { "id": 3, "name": "Engineering" },
  "min_salary": "2500.00",
  "max_salary": "4500.00",
  "employee_count": 6
}
```

- `GET /positions?department_id=3&all=true` — filter by department (for dependent dropdowns).
- `POST /positions` — `{ "department_id", "title", "min_salary"?, "max_salary"? }`.
  `409` duplicate title in the same department · `422` if `min_salary > max_salary`.
- `DELETE /positions/{id}` — `204`, or `409` if employees hold it.

### 4.6 Employees

`GET /employees` filters: `search` (name, code, email) · `department_id` · `position_id` ·
`status` (default `active`; `all` for everyone) · `manager_id`. Sort: `sort=last_name` (default),
`hire_date`, `employee_code`; prefix `-` for descending (`sort=-hire_date`).
Managers automatically get only their team.

`POST /employees`

```json
{
  "employee_code": "EMP-0057",
  "first_name": "Lina",
  "last_name": "Kamal",
  "email": "lina.kamal@company.test",
  "phone": null,
  "date_of_birth": "1998-03-09",
  "gender": "female",
  "national_id": null,
  "address": null,
  "department_id": 3,
  "position_id": 7,
  "manager_id": 4,
  "employment_type": "full_time",
  "base_salary": "2800.00",
  "hire_date": "2026-11-10"
}
```

`201` with Employee. Also creates this year's leave balances for every active paid leave type.
Errors: `409` duplicate `employee_code` / `email` / `national_id` · `422` position not in the given
department, unknown manager, invalid values.

`PATCH /employees/{id}` — any create field except `employee_code`. `422` if `manager_id` = own id.

`POST /employees/{id}/terminate`

```json
{ "termination_date": "2026-12-31" }
```

`200` with Employee (`status: "terminated"`). Also deactivates their user account.
`409` if already terminated.

### 4.7 Leave

Leave type object: `{ "id": 1, "name": "Annual", "default_days": 21, "is_paid": true, "is_active": true }`.
`GET /leave-types` returns active types only (`?all=true` includes inactive) — not paginated.

Leave balance object:

```json
{
  "id": 140,
  "employee": { "id": 12, "employee_code": "EMP-0012", "full_name": "Sara Ali" },
  "leave_type": { "id": 1, "name": "Annual" },
  "year": 2026,
  "allocated_days": 21,
  "used_days": 6,
  "remaining_days": 15
}
```

- `GET /leave-balances?employee_id=12&year=2026` — `year` defaults to the current year.
- `PATCH /leave-balances/{id}` — `{ "allocated_days": 23 }` (manual adjustment). `422` if below `used_days`.
- `POST /leave-balances/generate` — `{ "year": 2027 }`. Creates missing balances for all active
  employees × active paid types; existing rows are untouched. `200`:
  `{ "data": { "year": 2027, "created": 112 } }`.

`POST /leave-requests`

```json
{ "leave_type_id": 1, "start_date": "2026-11-16", "end_date": "2026-11-20", "reason": "Family trip" }
```

`201` with Leave request (`days` calculated by the server, Mon–Fri only). Errors:
- `422 VALIDATION_ERROR` — `end_date` before `start_date`, start in the past, range has 0 working days
- `422 INSUFFICIENT_BALANCE` — paid type and `days > remaining_days`
- `422 OVERLAPPING_REQUEST` — overlaps a pending/approved request of the same employee

`GET /leave-requests` filters: `status`, `employee_id`, `leave_type_id`, `department_id`,
`from` & `to` (requests touching that date range — used for the team calendar).
Managers get their team only; their own requests appear only in `/me/leave-requests`.

`POST /leave-requests/{id}/approve` and `/reject`

```json
{ "comment": "Enjoy your trip" }
```

`comment` optional for approve, **required** for reject. `200` with the updated Leave request.
Errors: `409` if not `pending` · `403` if it's the reviewer's own request · `422 INSUFFICIENT_BALANCE`
if the balance changed since submission (re-checked inside the approval transaction).

`POST /leave-requests/{id}/cancel` — no body. Only the owner, only while `pending`. `200`, `409` otherwise.

### 4.8 Attendance

`POST /attendance/check-in` — no body; the server uses its own clock. `201` with Attendance record
(`status` is `present` or `late`). `409` if already checked in today.

`POST /attendance/check-out` — no body. `200` with Attendance record. `409` if not checked in
today or already checked out.

`GET /attendance` filters: `date` (default today), `employee_id`, `department_id`, `status`.
Paginated list of Attendance records. Employees with no record that day are **not** listed — use the report for that.

`POST /attendance` (HR creates a missing day):

```json
{
  "employee_id": 12,
  "work_date": "2026-11-03",
  "check_in_at": "2026-11-03 09:00:00",
  "check_out_at": "2026-11-03 17:00:00",
  "status": "present",
  "correction_reason": "Badge reader was down"
}
```

`PATCH /attendance/{id}` — any of `check_in_at`, `check_out_at`, `status`, plus
**required** `correction_reason`. Both record who corrected and when. `409` if a record already
exists for that employee and day (on `POST`).

`GET /attendance/report?employee_id=12&month=2026-11` (and `GET /me/attendance?month=2026-11`):

```json
{
  "data": {
    "employee": { "id": 12, "employee_code": "EMP-0012", "full_name": "Sara Ali" },
    "month": "2026-11",
    "summary": {
      "working_days": 21,
      "present": 15,
      "late": 2,
      "absent": 1,
      "on_leave": 3,
      "worked_minutes": 8040
    },
    "days": [
      { "date": "2026-11-01", "status": "weekend", "check_in_at": null, "check_out_at": null, "worked_minutes": null },
      { "date": "2026-11-02", "status": "present", "check_in_at": "2026-11-02 08:55:00", "check_out_at": "2026-11-02 17:03:00", "worked_minutes": 488 }
    ]
  }
}
```

`days` contains every day of the month up to today. `status` is one of `present`, `late`, `absent`,
`on_leave`, `weekend`.

### 4.9 Payroll

Salary component object:
`{ "id": 31, "type": "allowance", "name": "Housing", "amount": "400.00", "is_active": true }`

- `GET /employees/{id}/salary-components` — not paginated.
- `POST /employees/{id}/salary-components` — `{ "type", "name", "amount" }`; `amount` > 0.
- `PATCH /salary-components/{id}` — any of `name`, `amount`, `is_active` (deactivate instead of delete).

Payroll run object:

```json
{
  "id": 9,
  "period_year": 2026,
  "period_month": 10,
  "status": "draft",
  "employee_count": 54,
  "total_net": "168420.50",
  "created_by": { "id": 2, "employee_code": "EMP-0002", "full_name": "Mona Adel" },
  "finalized_at": null,
  "created_at": "2026-11-01 10:00:00"
}
```

- `POST /payroll-runs` — `{ "period_year": 2026, "period_month": 10 }`. Creates a draft and a
  payslip for every employee active during that month. `201`. `409` if that month already has a run.
- `GET /payroll-runs/{id}` — run object plus `"payslips": [ …payslip summaries… ]`.
- `POST /payroll-runs/{id}/recalculate` — regenerates all payslips. `409` if finalized.
- `POST /payroll-runs/{id}/finalize` — locks the run. `409` if already finalized.
- `DELETE /payroll-runs/{id}` — `204`. `409` if finalized.

Payslip object (`GET /payslips/{id}`; list endpoints return it without `items`):

```json
{
  "id": 412,
  "payroll_run": { "id": 9, "period_year": 2026, "period_month": 10, "status": "finalized" },
  "employee": { "id": 12, "employee_code": "EMP-0012", "full_name": "Sara Ali" },
  "base_salary": "3200.00",
  "total_allowances": "550.00",
  "total_deductions": "120.00",
  "unpaid_leave_days": 1,
  "unpaid_leave_deduction": "145.45",
  "net_salary": "3484.55",
  "items": [
    { "type": "allowance", "name": "Housing", "amount": "400.00" },
    { "type": "allowance", "name": "Transport", "amount": "150.00" },
    { "type": "deduction", "name": "Insurance", "amount": "120.00" }
  ]
}
```

Employees can open only their own payslips, and only from finalized runs (`404` otherwise).

### 4.10 Settings

`GET /settings`:

```json
{ "data": { "work_start": "09:00", "work_end": "17:00", "late_grace_minutes": 15, "timezone": "UTC" } }
```

`PATCH /settings` (admin) — any subset of those keys. Returns the full settings object.

### 4.11 Dashboard

`GET /dashboard` — one endpoint; the content depends on the role.

Admin / HR:

```json
{
  "data": {
    "role_view": "hr",
    "headcount": { "total": 54, "by_department": [ { "department": { "id": 3, "name": "Engineering" }, "count": 18 } ] },
    "today": { "date": "2026-11-04", "present": 41, "late": 3, "on_leave": 4, "absent": 6 },
    "pending_leave_requests": 7
  }
}
```

Manager — same as Employee plus:

```json
"team": { "size": 8, "today": { "present": 6, "late": 1, "on_leave": 1, "absent": 0 }, "pending_leave_requests": 2 }
```

Employee:

```json
{
  "data": {
    "role_view": "employee",
    "today_attendance": { "…": "Attendance record or null" },
    "leave_balances": [ { "leave_type": { "id": 1, "name": "Annual" }, "remaining_days": 15 } ],
    "latest_payslip": { "id": 412, "period_year": 2026, "period_month": 10, "net_salary": "3484.55" }
  }
}
```

`role_view` is `hr` (also for admin), `manager` or `employee`.

## 5. Build order

Build and test endpoints in this order. The frontend follows the same order.

| Phase | Endpoints | Tables needed |
|---|---|---|
| 0 Foundation | `GET /health` | — |
| 1 Departments | `/departments` | `departments` |
| 2 Auth | `/auth/*`, `/users` | `employees`, `users`, `auth_tokens` (+ `positions` for seeding the admin) |
| 3 Org & employees | `/positions`, `/employees`, `/me`, `PATCH /me` | — |
| 4 Leave | `/leave-types`, `/leave-balances`, `/leave-requests`, `/me/leave-*` | `leave_types`, `leave_balances`, `leave_requests` |
| 5 Attendance | `/attendance/*`, `/me/attendance*`, `/settings` | `settings`, `attendance` |
| 6 Payroll | `/salary-components`, `/payroll-runs`, `/payslips`, `/me/payslips` | `salary_components`, `payroll_runs`, `payslips`, `payslip_items` |
| 7 Dashboard | `/dashboard` | — |

> Departments come before Auth so the first feature you build is the simplest one. Once Auth exists,
> go back and protect the department routes with the auth and role middleware.
