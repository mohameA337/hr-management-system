# HR Management System — Project Brief

Scope: version 3.0 — see `REQUIREMENTS.md`, `DATABASE.md` and `API.md` for the details.

## 1. Problem (WHY)

Many small and medium companies still manage employees and leave with spreadsheets, email and paper forms.
That causes real, everyday problems:

- **No single source of truth.** Employee details live in several spreadsheets that drift apart; nobody is sure
  which one is current.
- **Leave balances are calculated by hand.** HR counts days manually, often forgets weekends or public holidays,
  and employees can't see how many days they have left without asking.
- **Requests get lost.** Leave requests arrive by email or chat, approvals are informal, and there is no record
  of who approved what, when, or why something was rejected.
- **Rules are applied inconsistently.** Notice periods, overlapping requests and over-used balances depend on
  who handles the request, which feels unfair to employees.
- **Former employees keep access.** When someone leaves, their access and planned leave are not cleaned up
  reliably.
- **HR has no overview.** Answering "who is off today?" or "what is waiting for approval?" means searching
  through messages.

## 2. Project Goal

Build a small, secure web application that gives one company a **single, reliable place to manage employees
and leave**, and applies the company's leave rules automatically and consistently.

As a learning/portfolio project, the technical goal is a **clean, framework-free PHP 8.3 REST API** with a
MySQL database and a React frontend, built with professional practices: a written API contract, database
migrations, layered code (routes → middleware → controllers → models), validation, hashed credentials and
role-based access.

## 3. Expected Outcome

### Admin (in this version, the **HR** role is also the system administrator)

- Create login accounts for employees, choose their role (HR or Employee) and set their initial password.
- Reset an employee's password and promote or demote their role (but not their own).
- Deactivate access by terminating an employee, which logs them out immediately.

### HR

- Add, edit, search and list employees, and see who is active or terminated.
- Terminate an employee with a termination date; the system automatically cancels their pending and future leave.
- See every leave request, filter it by status or employee, and approve or reject requests (a reason is required
  to reject). HR can never approve their own leave.
- See at a glance: number of active employees, who is on leave today, what is waiting for approval, and upcoming
  public holidays.
- Everything an employee can do (HR staff request leave too).

### Employee

- Log in securely and see their own leave balance (Annual and Sick) for the current year.
- Request leave and immediately see how many working days it costs — weekends and public holidays are not
  counted.
- Get a clear explanation when a request breaks a rule (not enough notice, too far in the past, overlapping
  dates, not enough days left).
- Follow the status of their requests and HR's comments, and cancel a request (or approved leave that hasn't
  started yet — the days come back).
- See the company's public holidays.

## 4. Acceptance Criteria (WHEN IS IT DONE?)

The project is complete when **all** of the following are true.

### 4.1 Functionality

- [ ] All **9 endpoints** in `API.md` are implemented and return exactly the documented JSON, status codes and
      error format.
- [ ] The React frontend runs against the real PHP backend (`VITE_USE_MOCKS=false`) with every screen working:
      login, dashboard, my leave, public holidays, employees (HR) and leave requests (HR).
- [ ] An HR user can add an employee, that employee can log in, request leave, HR approves it, and the
      employee's balance goes down — end to end, in the browser.
- [ ] Terminating an employee prevents them from logging in and cancels their pending and future leave.

### 4.2 Business rules (each verified with a passing and a failing case)

- [ ] Leave days exclude Saturdays, Sundays and public holidays (e.g. Mon–Fri of Thanksgiving week = 4 days).
- [ ] Annual leave needs at least 3 working days' notice; sick leave may start up to 7 days in the past.
- [ ] Requests can't overlap the employee's pending or approved leave, can't exceed the remaining balance and
      must stay within one calendar year.
- [ ] Balances are per calendar year (21 Annual, 10 Sick) with no carry-over; cancelling approved leave
      restores the days.
- [ ] Rejecting requires a comment; HR cannot review their own request; approved leave can only be cancelled
      before it starts.
- [ ] Employee code and email are unique; HR cannot change their own role or terminate themselves.

### 4.3 Security

- [ ] Passwords are stored with `password_hash()`; only SHA-256 hashes of login tokens are stored; tokens
      expire after 8 hours.
- [ ] Every endpoint except login requires a valid token; HR-only endpoints return `403` for employees;
      employees can never see other employees' leave.
- [ ] All SQL uses prepared statements; all input is validated on the server.
- [ ] Only `public/` is web-accessible; secrets live only in `.env` (not in Git); error responses never expose
      PHP errors or SQL.

### 4.4 Quality and delivery

- [ ] The database is created only through the migrations and seeds in `database/` (`php bin/migrate.php`,
      `php bin/seed.php`), and the first HR user through `php bin/create-hr-user.php`.
- [ ] A new developer can set up and run the project by following `README.md` alone.
- [ ] The code follows the agreed structure (routes → middleware → controllers → models/services), PSR-4
      autoloading and PSR-12 style, with no PHP framework.
- [ ] Every endpoint has been tested with `curl` (success and error cases), following `BACKEND_GUIDE.md`.
- [ ] The documentation (`PROJECT_BRIEF`, `REQUIREMENTS`, `DATABASE`, `API`, `BACKEND_GUIDE`) matches the
      final code, and the work is committed to Git in small, clearly described commits.

### 4.5 Out of scope (not required for "done")

Separate Admin role, departments as their own records, managing holidays in the app, password change by
employees, a logout endpoint, managers, attendance and payroll — see `REQUIREMENTS.md` §6.
