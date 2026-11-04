# HR Management System — API Contract

Status: **v2.0 (simplified)** — based on `REQUIREMENTS.md` v2.0 and `DATABASE.md` v2.0. **24 endpoints.**

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

During development the React app (Vite, `localhost:5173`) forwards `/api/*` to `http://hr.localhost`,
so the browser sees one origin and **the backend needs no CORS code**.

### Data formats

| Type | Format | Example |
|---|---|---|
| IDs | integer | `12` |
| Field names | `snake_case`, same as the database | `first_name` |
| Date | `YYYY-MM-DD` | `"2026-11-04"` |
| Date-time | `YYYY-MM-DD HH:MM:SS`, company timezone | `"2026-11-04 09:12:30"` |
| Empty value | `null` (not `""`) | `"phone": null` |

### Success responses

```json
{ "data": { "id": 3, "name": "Engineering" } }
```

Paginated list:

```json
{
  "data": [ { "id": 3, "name": "Engineering" } ],
  "meta": { "page": 1, "per_page": 20, "total": 57, "total_pages": 3 }
}
```

Lists accept `?page=1&per_page=20` (default 20, max 100). Action with nothing to return: `204 No Content`.

### Error responses

Every error has the same shape:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "The given data was invalid.",
    "details": {
      "email": ["The email field is required."]
    }
  }
}
```

`details` (field → messages) is present only for `VALIDATION_ERROR`.

| HTTP | `code` | When |
|---|---|---|
| 400 | `BAD_REQUEST` | body is not valid JSON |
| 401 | `UNAUTHENTICATED` | missing, invalid or expired token; wrong email/password |
| 403 | `FORBIDDEN` | logged in, but the role isn't allowed |
| 404 | `NOT_FOUND` | unknown route or record |
| 409 | `CONFLICT` | duplicate value, record in use, or action not allowed in the current status |
| 422 | `VALIDATION_ERROR` | invalid fields (see `details`) |
| 422 | `INSUFFICIENT_BALANCE` | leave request needs more days than remain |
| 422 | `OVERLAPPING_REQUEST` | leave dates overlap a pending/approved request |
| 500 | `SERVER_ERROR` | unexpected error — never expose PHP messages or SQL |

## 2. Endpoints

`HR` = role `hr` only · `all` = any logged-in user.

| # | Method | Path | Roles | Req. |
|---|---|---|---|---|
| 1 | GET | `/health` | public | — |
| | **Auth** | | | |
| 2 | POST | `/auth/login` | public | AUTH-1 |
| 3 | POST | `/auth/logout` | all | AUTH-3 |
| 4 | GET | `/auth/me` | all | — |
| 5 | PUT | `/auth/password` | all | AUTH-3 |
| | **Departments** | | | |
| 6 | GET | `/departments` | HR | DEPT-1 |
| 7 | POST | `/departments` | HR | DEPT-1 |
| 8 | PATCH | `/departments/{id}` | HR | DEPT-1 |
| 9 | DELETE | `/departments/{id}` | HR | DEPT-2 |
| | **Employees** | | | |
| 10 | GET | `/employees` | HR | EMP-4 |
| 11 | GET | `/employees/{id}` | HR | EMP-5 |
| 12 | POST | `/employees` | HR | EMP-1 |
| 13 | PATCH | `/employees/{id}` | HR | EMP-2 |
| 14 | POST | `/employees/{id}/terminate` | HR | EMP-3 |
| 15 | GET | `/employees/{id}/leave-balances` | HR | EMP-5 |
| | **Leave** | | | |
| 16 | GET | `/leave-types` | all | LEAVE-1 |
| 17 | GET | `/me/leave-balances` | all | LEAVE-2 |
| 18 | GET | `/me/leave-requests` | all | LEAVE-6 |
| 19 | POST | `/leave-requests` | all | LEAVE-3–5 |
| 20 | POST | `/leave-requests/{id}/cancel` | owner | LEAVE-6 |
| 21 | GET | `/leave-requests` | HR | LEAVE-7 |
| 22 | POST | `/leave-requests/{id}/approve` | HR | LEAVE-7–8 |
| 23 | POST | `/leave-requests/{id}/reject` | HR | LEAVE-7 |
| | **Dashboard** | | | |
| 24 | GET | `/dashboard` | all | DASH-1–2 |

> **Why `POST /leave-requests/{id}/approve` instead of `PATCH` with `status`?** Approving is an
> *action* with its own rules (permission, balance re-check), not a field edit. One endpoint per action
> keeps each rule in one place.

## 3. Shared objects

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
  "job_title": "Backend Developer",
  "department": { "id": 3, "name": "Engineering" },
  "hire_date": "2024-02-01",
  "status": "active",
  "termination_date": null,
  "role": "employee",
  "last_login_at": "2026-11-04 08:58:02",
  "created_at": "2024-01-28 10:15:00",
  "updated_at": "2026-10-02 14:40:11"
}
```

`password_hash` is **never** returned.

### Leave balance

```json
{ "leave_type": { "id": 1, "name": "Annual" }, "year": 2026, "days_per_year": 21, "used_days": 6, "remaining_days": 15 }
```

### Leave request

```json
{
  "id": 88,
  "employee": { "id": 12, "employee_code": "EMP-0012", "full_name": "Sara Ali" },
  "leave_type": { "id": 1, "name": "Annual" },
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

## 4. Endpoint details

Unless stated otherwise: `POST` returns `201` with the created object; `PATCH` accepts any subset of
the create fields and returns `200` with the updated object.

### 4.1 Health

`GET /health` → `200` `{ "data": { "status": "ok" } }`

### 4.2 Auth

`POST /auth/login`

```json
{ "email": "sara.ali@company.test", "password": "secret-password" }
```

`200`:

```json
{ "data": { "token": "9f2c4e…64 hex chars…", "expires_at": "2026-11-04 17:00:00", "user": { "…": "Employee object" } } }
```

Errors: `422` missing fields · `401` wrong email/password **or** terminated employee — same message
for all, so nobody can find out which emails exist.

`POST /auth/logout` → `204`, deletes the current token.

`GET /auth/me` → `200` with the logged-in user's Employee object. Called on page load to restore the session.

`PUT /auth/password` — `{ "current_password": "…", "new_password": "…" }` → `204`.
`422` if `current_password` is wrong or `new_password` is shorter than 8 characters.

### 4.3 Departments (HR)

Department object:

```json
{ "id": 3, "name": "Engineering", "description": "Product development", "employee_count": 18 }
```

`employee_count` counts active employees.

- `GET /departments?search=eng` — paginated, sorted by name. `?all=true` returns all without pagination (dropdowns).
- `POST /departments` — `{ "name", "description"? }`. `409` duplicate name.
- `PATCH /departments/{id}` — same fields.
- `DELETE /departments/{id}` — `204`, or `409` if any employee (active or terminated) belongs to it.

### 4.4 Employees (HR)

`GET /employees` — filters: `search` (name, code, email) · `department_id` · `status` (default `active`;
`terminated`; `all`). Sorted by last name. Paginated list of Employee objects.

`POST /employees`

```json
{
  "employee_code": "EMP-0057",
  "first_name": "Lina",
  "last_name": "Kamal",
  "email": "lina.kamal@company.test",
  "phone": null,
  "job_title": "Frontend Developer",
  "department_id": 3,
  "hire_date": "2026-11-10",
  "role": "employee",
  "password": "initial-password"
}
```

`201` with Employee. Errors: `409` duplicate `employee_code` or `email` · `422` invalid fields
(`password` at least 8 characters, unknown department, invalid role).

`PATCH /employees/{id}` — any create field except `employee_code`. `password` is optional and resets
the password when given. An HR user cannot change their own `role` (`409`).

`POST /employees/{id}/terminate` — `{ "termination_date": "2026-12-31" }` → `200` with Employee.
Deletes their tokens (logs them out). `409` if already terminated or if it is your own account.

`GET /employees/{id}/leave-balances?year=2026` — list (not paginated) of Leave balance objects, one per
leave type. `year` defaults to the current year.

### 4.5 Leave

`GET /leave-types` → `{ "data": [ { "id": 1, "name": "Annual", "days_per_year": 21 }, … ] }` (not paginated).

`GET /me/leave-balances?year=2026` — same as the employee version above, for the logged-in user.

`GET /me/leave-requests?status=pending` — paginated, newest first.

`POST /leave-requests`

```json
{ "leave_type_id": 1, "start_date": "2026-11-16", "end_date": "2026-11-20", "reason": "Family trip" }
```

`201` with Leave request; `days` is calculated by the server (Mon–Fri only). Errors:
- `422 VALIDATION_ERROR` — missing/invalid fields, start in the past, end before start, start and end in
  different years, no working days in the range
- `422 OVERLAPPING_REQUEST` — overlaps a pending/approved request of the same employee
- `422 INSUFFICIENT_BALANCE` — `days` is more than `remaining_days` for that type and year

`POST /leave-requests/{id}/cancel` — no body. Owner only (others get `404`), only while `pending` (`409`). `200`.

`GET /leave-requests` (HR) — filters: `status`, `employee_id`, `department_id`, and `from` & `to`
(requests touching that date range). Paginated; `status=pending` is sorted oldest first, otherwise newest first.

`POST /leave-requests/{id}/approve` — `{ "comment": "Enjoy!" }` (optional).
`POST /leave-requests/{id}/reject` — `{ "comment": "Busy week, please pick another" }` (**required**).

Both return `200` with the Leave request. Errors: `409` not `pending` · `403` reviewing your own
request · `422 INSUFFICIENT_BALANCE` on approve if the remaining days changed since submission.

### 4.6 Dashboard

`GET /dashboard` — content depends on the role.

HR:

```json
{
  "data": {
    "role_view": "hr",
    "active_employees": 54,
    "by_department": [ { "department": { "id": 3, "name": "Engineering" }, "count": 18 } ],
    "on_leave_today": [
      { "employee": { "id": 7, "employee_code": "EMP-0007", "full_name": "Lina Kamal" }, "leave_type": { "id": 1, "name": "Annual" }, "end_date": "2026-11-05" }
    ],
    "pending_leave_requests": 7
  }
}
```

Employee:

```json
{
  "data": {
    "role_view": "employee",
    "leave_balances": [ { "…": "Leave balance objects" } ],
    "recent_leave_requests": [ { "…": "up to 5 Leave request objects, newest first" } ]
  }
}
```

## 5. Build order

| Phase | Endpoints | Tables |
|---|---|---|
| 0 Foundation | `GET /health` | — |
| 1 Departments | #6–9 | `departments` |
| 2 Auth | #2–5 | `employees`, `auth_tokens` (+ seed the first HR user) |
| 3 Employees | #10–14 | — |
| 4 Leave | #15–23 | `leave_types`, `leave_requests` |
| 5 Dashboard | #24 | — |

> Departments come before Auth so the first feature is the simplest one. Once Auth exists, go back and
> protect the department routes with the auth and HR-role middleware.
