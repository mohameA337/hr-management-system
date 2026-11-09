# HR Management System — Requirements

Status: **v3.0 (minimal)** — 4 tables, 9 endpoints. Earlier, larger designs are in Git history and listed
under "Later versions".

## 1. Overview

A small web-based HR system for one company. HR adds employees and approves leave; employees log in to
request leave and follow its status.

- **Purpose:** learning / portfolio project — a small backend done well.
- **Backend:** plain PHP 8.3 REST API (JSON), MySQL 8.0 — built by the project owner.
- **Frontend:** React + Vite single-page app — consumes the REST API only.
- **Contract between them:** `docs/API.md`.

## 2. Roles

| Role | Can do |
|---|---|
| **HR** | Add, edit and terminate employees (and set their role and password); see all leave requests; approve or reject them; plus everything an employee can do |
| **Employee** | Log in, see own profile and leave balance, request leave, cancel own leave, see public holidays |

Every employee is also a login account (email + password). Terminated employees cannot log in.

## 3. Functional requirements

### 3.1 Login (AUTH)

- **AUTH-1** Users log in with email + password and receive a token used on every later request. Tokens
  expire after 8 hours.
- **AUTH-2** Passwords are stored hashed (`password_hash`), never in plain text.
- **AUTH-3** Logging out forgets the token in the browser. HR resets forgotten passwords.
- **AUTH-4** Every endpoint except login requires a valid token and checks the role.

### 3.2 Employees (EMP)

- **EMP-1** HR adds an employee: employee code (unique), first/last name, email (unique), phone, job title,
  department (text), hire date, role (`hr` / `employee`), initial password.
- **EMP-2** HR edits these fields and can reset the password. The employee code cannot change.
- **EMP-3** HR terminates an employee by setting status `terminated` and a termination date. This also logs
  them out and cancels their pending leave and approved leave that starts after the termination date.
  Records are never deleted, and a terminated employee cannot be reactivated.
- **EMP-4** HR cannot change their own role or terminate themselves.
- **EMP-5** Employee list with search (name, code, email), status filter and pagination.

### 3.3 Leave (LEAVE)

- **LEAVE-1** Two leave types, fixed in the code:

  | Type | Days per year | Kind | Notice | May start in the past |
  |---|---|---|---|---|
  | `annual` | 21 | planned | at least **3 working days** ahead | no |
  | `sick` | 10 | unplanned | none | up to **7 days** back |

- **LEAVE-2** Remaining days = days per year − approved days in that calendar year. No carry-over.
- **LEAVE-3** An employee requests leave: type, first day, last day, optional reason.
- **LEAVE-4** Leave days = working days in the range: Saturdays, Sundays and public holidays are not counted.
  The count is saved when the request is submitted.
- **LEAVE-5** A request is refused when: the last day is before the first · the dates are in different years ·
  there are no working days · the notice / "in the past" limit of LEAVE-1 is broken · it overlaps the
  employee's other pending or approved leave · it needs more days than remain.
- **LEAVE-6** Status flow: `pending` → `approved` / `rejected` (by HR) or `cancelled` (by the employee).
  Approved leave can still be cancelled by the employee until it starts; the days come back automatically.
- **LEAVE-7** HR cannot approve or reject their own request. Rejecting needs a comment. The balance is
  checked again when approving.

### 3.4 Public holidays (HOL)

- **HOL-1** A list of public holidays (date + name), loaded into the database with a seed file.
- **HOL-2** Everyone can see the list; holidays are not counted as leave days.

## 4. Business rules (summary)

1. Records are never deleted; employees are terminated instead.
2. Employee code and email are unique.
3. Work week is Monday–Friday; public holidays are not working days.
4. Annual leave is planned (3 working days' notice); sick leave is unplanned (up to 7 days back).
5. Balances are per calendar year; no carry-over; leave can't exceed the balance or overlap.
6. Approved leave can be cancelled only before it starts.

## 5. Non-functional requirements

- REST + JSON, `/api/v1` prefix, one error format, correct HTTP status codes (see `API.md`).
- Hashed passwords, hashed tokens, role check on every endpoint, prepared statements only, server-side
  validation, only `public/` web-accessible, secrets only in `.env`.
- Responsive English UI.

## 6. Later versions

Logout endpoint and password change · departments as a table · managing holidays in the app · a dashboard
endpoint · more leave types and pro-rata days · managers approving their team · attendance · payroll.
