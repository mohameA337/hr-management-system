# HR Management System — Requirements

Status: **v1.0** — open questions resolved; basis for database and API design.

## 1. Overview

A web-based HR system for a single company. HR staff manage employees, departments, leave,
attendance and payroll; managers approve their team's requests; employees use self-service.

- **Purpose:** learning / portfolio project — clean, understandable code over feature breadth.
- **Backend:** plain PHP 8.3 REST API (JSON), MySQL 8.0 — built by the project owner.
- **Frontend:** React + Vite single-page app — consumes the REST API only.
- **Contract between them:** `docs/API.md` (to be written after the database design).

## 2. Roles

| Role | Who | Summary |
|---|---|---|
| **Admin** | System owner | Everything HR can do + manage user accounts and roles, system settings |
| **HR** | HR staff | Manage employees, departments, positions, leave types, attendance, payroll |
| **Manager** | Department/team lead | Everything an Employee can do + view their team, approve/reject team leave, view team attendance |
| **Employee** | Every staff member | View own profile, request leave, check in/out, view own payslips |

Each user account belongs to exactly one employee record and has exactly one role.
A manager's "team" = employees whose `manager_id` points to them.

### Permission matrix

| Action | Admin | HR | Manager | Employee |
|---|:-:|:-:|:-:|:-:|
| Manage user accounts & roles | ✅ | — | — | — |
| Create / edit / deactivate employees | ✅ | ✅ | — | — |
| View all employees | ✅ | ✅ | team only | — |
| View / edit own profile (limited fields) | ✅ | ✅ | ✅ | ✅ |
| Manage departments & positions | ✅ | ✅ | — | — |
| Manage leave types & balances | ✅ | ✅ | — | — |
| Request leave | ✅ | ✅ | ✅ | ✅ |
| Approve / reject leave | ✅ | ✅ | team only | — |
| Check in / check out | ✅ | ✅ | ✅ | ✅ |
| View / correct attendance | ✅ | ✅ | view team | own only |
| Manage salaries & run payroll | ✅ | ✅ | — | — |
| View payslips | ✅ | ✅ | own only | own only |
| Dashboard | full | full | team | personal |

## 3. Functional requirements

### 3.1 Authentication & users (AUTH)

- **AUTH-1** Users log in with email + password; the API returns a token used on later requests.
- **AUTH-2** Passwords are stored hashed (`password_hash`), never in plain text.
- **AUTH-3** Users can log out (token invalidated) and change their own password.
- **AUTH-4** Admin creates a user account for an existing employee and assigns a role.
- **AUTH-5** Admin can deactivate an account; deactivated users cannot log in.
- **AUTH-6** Every API endpoint except login requires a valid token and checks the role.

### 3.2 Employees (EMP)

- **EMP-1** HR creates an employee: employee code (unique), first/last name, email (unique),
  phone, date of birth, gender, national ID, address, hire date, department, position,
  manager, employment type (full-time / part-time / contract), base salary.
- **EMP-2** HR edits any employee field; employees can edit only their phone and address.
- **EMP-3** HR deactivates an employee (status `terminated` + termination date) — records are never hard-deleted.
- **EMP-4** Employee list with search (name, code, email), filters (department, position, status) and pagination.
- **EMP-5** Employee detail page shows profile, leave balances, recent attendance and payslips.

### 3.3 Departments & positions (ORG)

- **ORG-1** HR manages departments: name (unique), description, head (an employee).
- **ORG-2** HR manages positions/job titles: title, department, optional salary range.
- **ORG-3** A department or position cannot be deleted while active employees are assigned to it.
- **ORG-4** Each employee has at most one direct manager; an employee cannot be their own manager.

### 3.4 Leave management (LEAVE)

- **LEAVE-1** HR manages leave types: name (Annual, Sick, Unpaid, …), default days per year, paid/unpaid.
- **LEAVE-2** Each employee has a yearly balance per leave type (allocated, used, remaining).
- **LEAVE-3** Employee submits a request: leave type, start date, end date, reason.
- **LEAVE-4** Requested days = working days between start and end (Saturday and Sunday excluded).
- **LEAVE-5** A request is rejected on submit if it exceeds the remaining balance (paid types) or
  overlaps another pending/approved request of the same employee.
- **LEAVE-6** Status flow: `pending` → `approved` | `rejected`; the employee may `cancel` while pending.
- **LEAVE-7** The employee's manager (or HR) approves/rejects with an optional comment.
  Managers cannot approve their own requests — those go to HR.
- **LEAVE-8** Balance is deducted only on approval.
- **LEAVE-10** Balances are per calendar year; unused days do **not** carry over. On 1 January
  each employee gets a new balance equal to the leave type's default days.
- **LEAVE-9** Views: my requests, pending approvals (manager/HR), all requests (HR), team calendar.

### 3.5 Attendance (ATT)

- **ATT-1** Employee checks in and checks out once per day; the server records the time.
- **ATT-2** Work hours = check-out − check-in.
- **ATT-3** Company work schedule is a setting (default 09:00–17:00, Monday–Friday);
  check-in after start + grace period (default 15 min) is marked `late`.
- **ATT-4** Day status: `present`, `late`, `absent`, `on_leave` (from approved leave), `weekend`.
- **ATT-5** HR can correct an attendance record; the correction stores who changed it and why.
- **ATT-6** Monthly report per employee: days present, late, absent, on leave, total hours.

### 3.6 Payroll (PAY) — simplified

- **PAY-1** Each employee has a base monthly salary (from EMP-1).
- **PAY-2** HR manages recurring salary components per employee: allowances (housing, transport, …)
  and deductions (insurance, loan, …) as fixed amounts.
- **PAY-3** HR runs payroll for a month → one payslip per active employee:
  `net = base + allowances − deductions − unpaid-leave deduction`.
- **PAY-4** Unpaid-leave deduction = (base ÷ working days in month) × unpaid leave days.
- **PAY-5** Payroll run status: `draft` (editable, can be recalculated) → `finalized` (locked).
- **PAY-6** Employees view and print their own finalized payslips.
- **Not included:** taxes, overtime, bonuses, bank transfers (possible phase 2).

### 3.7 Dashboard (DASH)

- **DASH-1** HR/Admin: headcount by department, on leave today, absent today, pending leave requests.
- **DASH-2** Manager: team present/absent today, team pending requests.
- **DASH-3** Employee: today's check-in status, leave balances, latest payslip.

## 4. Business rules (summary)

1. Records are soft-deleted / deactivated, never hard-deleted (history matters for payroll).
2. Employee code and email are unique.
3. Leave cannot exceed balance (paid types) and requests cannot overlap.
4. Only one check-in and one check-out per employee per day.
5. Finalized payroll is read-only.
6. All money is in **USD**, stored as `DECIMAL(12,2)`; all dates/times stored in one timezone (company timezone).
7. Work week is Monday–Friday; Saturday and Sunday are weekends.
8. Leave balances reset every calendar year with no carry-over.

## 5. Non-functional requirements

- **API:** REST, JSON only, consistent error format, proper HTTP status codes, `/api/v1/...` prefix.
- **Security:** hashed passwords, token auth, role checks on every endpoint, prepared statements (PDO)
  only, input validation on the server, only `public/` web-accessible, secrets only in `.env`.
- **Validation:** frontend validates for UX; backend validates for correctness (source of truth).
- **Pagination:** list endpoints are paginated.
- **Frontend:** responsive (desktop first, usable on mobile), English-only UI (left-to-right).
- **Code quality:** PSR-12 style, no framework, small readable classes.

## 6. Out of scope (for now)

Recruitment, performance reviews, training, document uploads, announcements, email notifications,
multi-company / multi-currency, taxes, public holidays calendar, mobile app.

## 7. Decisions

| Question | Decision |
|---|---|
| Work week | Monday–Friday |
| Payroll currency | USD |
| Annual leave carry-over | No — balances reset each calendar year |
| UI language | English only |

## 8. Next steps

1. Review and finalize this document.
2. `docs/DATABASE.md` — tables, columns, relationships (ERD).
3. `docs/API.md` — endpoints with request/response examples.
4. Build module by module: Auth → Employees/Org → Leave → Attendance → Payroll → Dashboard.
