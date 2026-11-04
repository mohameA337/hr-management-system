# HR Management System — Requirements

Status: **v2.0 (simplified)** — replaces v1.0. The full v1.0 scope (attendance, payroll, managers,
positions, …) is kept in Git history and listed under "Later versions" below.

## 1. Overview

A small web-based HR system for one company. HR staff manage departments and employees and
approve leave; employees log in to request leave and follow its status.

- **Purpose:** learning / portfolio project — clean, understandable code over feature breadth.
- **Backend:** plain PHP 8.3 REST API (JSON), MySQL 8.0 — built by the project owner.
- **Frontend:** React + Vite single-page app — consumes the REST API only.
- **Contract between them:** `docs/API.md`.

## 2. Roles

| Role | Who | Can do |
|---|---|---|
| **HR** | HR staff (also acts as system admin) | Everything: manage departments and employees, approve/reject leave, plus everything an employee can do |
| **Employee** | Every staff member | Log in, see own profile and leave balance, request and cancel leave, change own password |

Every employee record is also a login account (email + password). Terminated employees cannot log in.

### Permission matrix

| Action | HR | Employee |
|---|:-:|:-:|
| Manage departments | ✅ | — |
| Create / edit / terminate employees, set role and password | ✅ | — |
| View all employees | ✅ | — |
| View own profile, change own password | ✅ | ✅ |
| Request / cancel own leave, view own balance | ✅ | ✅ |
| View all leave requests, approve / reject | ✅ (not own) | — |
| Dashboard | company overview | personal |

## 3. Functional requirements

### 3.1 Authentication (AUTH)

- **AUTH-1** Users log in with email + password; the API returns a token used on later requests.
- **AUTH-2** Passwords are stored hashed (`password_hash`), never in plain text.
- **AUTH-3** Users can log out (token deleted) and change their own password.
- **AUTH-4** Every endpoint except login requires a valid token and checks the role.
- **AUTH-5** Terminated employees cannot log in, and their tokens are deleted.

### 3.2 Departments (DEPT)

- **DEPT-1** HR creates, edits and lists departments: name (unique), description.
- **DEPT-2** A department cannot be deleted while employees belong to it.

### 3.3 Employees (EMP)

- **EMP-1** HR creates an employee: employee code (unique), first/last name, email (unique),
  phone, job title, department, hire date, role (`hr` / `employee`), initial password.
- **EMP-2** HR edits any of these fields and can reset the password. The employee code cannot change.
- **EMP-3** HR terminates an employee (status `terminated` + termination date). Records are never deleted.
- **EMP-4** Employee list with search (name, code, email), filters (department, status) and pagination.
- **EMP-5** Employee detail shows the profile, leave balance and leave history.

### 3.4 Leave (LEAVE)

- **LEAVE-1** Two leave types, set up once in the database: **Annual** (21 days/year) and **Sick** (10 days/year).
- **LEAVE-2** Remaining days = days per year − approved days in that calendar year. Unused days do not
  carry over; a new year starts with the full amount automatically.
- **LEAVE-3** An employee submits a request: leave type, start date, end date, optional reason.
- **LEAVE-4** Requested days = working days between start and end (Saturday and Sunday excluded).
- **LEAVE-5** A request is refused on submit when:
  the start date is in the past · the end date is before the start date · start and end are in different years ·
  the range has no working days · it overlaps another pending/approved request of the same employee ·
  it needs more days than remain.
- **LEAVE-6** Status flow: `pending` → `approved` | `rejected`; the employee may `cancel` while pending.
- **LEAVE-7** HR approves (optional comment) or rejects (comment required). HR cannot review their own request.
- **LEAVE-8** The balance is checked again at approval time.

### 3.5 Dashboard (DASH)

- **DASH-1** HR: active employees, employees per department, on leave today, pending requests.
- **DASH-2** Employee: remaining days per leave type, latest requests.

## 4. Business rules (summary)

1. Records are deactivated (terminated), never deleted.
2. Employee code and email are unique.
3. Leave cannot exceed the remaining balance and requests cannot overlap.
4. Work week is Monday–Friday. Leave balances are per calendar year with no carry-over.
5. All dates are stored in the company timezone.

## 5. Non-functional requirements

- **API:** REST, JSON only, consistent error format, proper HTTP status codes, `/api/v1/...` prefix.
- **Security:** hashed passwords, token auth, role check on every endpoint, prepared statements (PDO)
  only, input validation on the server, only `public/` web-accessible, secrets only in `.env`.
- **Validation:** frontend validates for UX; backend validates for correctness (source of truth).
- **Pagination:** list endpoints are paginated.
- **Frontend:** responsive (desktop first, usable on mobile), English-only UI.
- **Code quality:** PSR-12 style, no framework, small readable classes.

## 6. Decisions

| Question | Decision |
|---|---|
| Roles | HR and Employee only (HR is also the admin) |
| Work week | Monday–Friday |
| Annual leave carry-over | No — remaining days are counted per calendar year |
| UI language | English only |

## 7. Later versions (out of scope now)

Kept for after the first version works end to end:

- **Managers** approving their own team's leave (team-only access everywhere)
- **Attendance:** check-in/out, lateness, monthly reports, HR corrections
- **Payroll:** salaries, allowances/deductions, monthly payslips (USD)
- **Positions** with salary ranges, separate user accounts and an Admin role
- Leave-type management, manual balance adjustments, unpaid leave
- Recruitment, performance reviews, documents, notifications

## 8. Build order

1. Foundation (`GET /health`) → 2. Departments → 3. Auth → 4. Employees → 5. Leave → 6. Dashboard
