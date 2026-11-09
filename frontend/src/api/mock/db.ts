// In-memory copy of the 4 tables from docs/DATABASE.md, saved in localStorage so that changes
// survive a page reload. "Reset demo data" on the login page re-seeds it.

import type { EmployeeStatus, LeaveStatus, LeaveType, Role } from '../types';
import { addDays, addMonths, currentMonthKey, isWeekend, parseDateKey, todayKey, workingDaysBetween } from '../../lib/dates';

export interface EmployeeRow {
  id: number;
  employee_code: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  job_title: string;
  department: string;
  hire_date: string;
  status: EmployeeStatus;
  termination_date: string | null;
  role: Role;
  /** Plain text only because this is a fake backend — the real one stores password_hash(). */
  password: string;
  last_login_at: string | null;
}

export interface TokenRow {
  token: string;
  employee_id: number;
}

export interface LeaveRequestRow {
  id: number;
  employee_id: number;
  type: LeaveType;
  start_date: string;
  end_date: string;
  days: number;
  reason: string | null;
  status: LeaveStatus;
  reviewed_by: number | null;
  review_comment: string | null;
  reviewed_at: string | null;
  created_at: string;
}

export interface HolidayRow {
  id: number;
  holiday_date: string;
  name: string;
}

export interface MockDb {
  employees: EmployeeRow[];
  auth_tokens: TokenRow[];
  leave_requests: LeaveRequestRow[];
  public_holidays: HolidayRow[];
}

export function nextId(rows: { id: number }[]): number {
  return rows.reduce((max, row) => Math.max(max, row.id), 0) + 1;
}

// ---------- Persistence ----------

const STORAGE_KEY = 'hr.mockdb.v4';
let db: MockDb | null = null;

export function getDb(): MockDb {
  if (db) return db;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) db = JSON.parse(stored) as MockDb;
  } catch {
    db = null;
  }
  db ??= seed();
  saveDb();
  return db;
}

export function saveDb() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  } catch {
    // Storage full or blocked: data then lives only until reload.
  }
}

export function resetDb() {
  db = seed();
  saveDb();
}

// ---------- Seed data (relative to today, so the demo always looks current) ----------

/** n working days starting on the first working day on/after `from`. */
function workRange(from: string, n: number): { start: string; end: string } {
  let start = from;
  while (isWeekend(start)) start = addDays(start, 1);
  let end = start;
  for (let counted = 1; counted < n; ) {
    end = addDays(end, 1);
    if (!isWeekend(end)) counted++;
  }
  return { start, end };
}

/** US Thanksgiving: the fourth Thursday of November. */
function thanksgiving(year: number): string {
  const firstThursday = 1 + ((4 - new Date(year, 10, 1).getDay() + 7) % 7);
  return `${year}-11-${String(firstThursday + 21).padStart(2, '0')}`;
}

function seed(): MockDb {
  const today = todayKey();
  const year = Number(today.slice(0, 4));
  const lastMonth = addMonths(currentMonthKey(), -1);
  const stamp = (date: string, time = '10:00:00') => `${date} ${time}`;

  // first, last, email, job title, department, hire date, role
  const people: [string, string, string, string, string, string, Role][] = [
    ['Adam', 'Carter', 'adam.carter@company.test', 'Chief Executive Officer', 'Management', '2022-01-03', 'employee'],
    ['Mona', 'Adel', 'hr@hr.test', 'HR Manager', 'Human Resources', '2022-01-10', 'hr'],
    ['Karim', 'Nabil', 'karim.nabil@company.test', 'HR Specialist', 'Human Resources', '2023-04-02', 'hr'],
    ['Omar', 'Hassan', 'omar.hassan@company.test', 'Engineering Manager', 'Engineering', '2022-02-01', 'employee'],
    ['Sara', 'Ali', 'employee@hr.test', 'Backend Developer', 'Engineering', '2024-02-01', 'employee'],
    ['Youssef', 'Ibrahim', 'youssef.ibrahim@company.test', 'Backend Developer', 'Engineering', '2023-06-12', 'employee'],
    ['Lina', 'Kamal', 'lina.kamal@company.test', 'Frontend Developer', 'Engineering', '2024-09-01', 'employee'],
    ['David', 'Miller', 'david.miller@company.test', 'Frontend Developer', 'Engineering', '2023-01-16', 'employee'],
    ['Nour', 'Salem', 'nour.salem@company.test', 'QA Engineer', 'Engineering', '2025-03-03', 'employee'],
    ['Rachel', 'Green', 'rachel.green@company.test', 'Sales Manager', 'Sales', '2022-02-14', 'employee'],
    ['Ahmed', 'Fathy', 'ahmed.fathy@company.test', 'Sales Representative', 'Sales', '2023-08-21', 'employee'],
    ['Emily', 'Clark', 'emily.clark@company.test', 'Sales Representative', 'Sales', '2024-05-06', 'employee'],
    ['Tarek', 'Mostafa', 'tarek.mostafa@company.test', 'Sales Representative', 'Sales', '2025-01-13', 'employee'],
    ['Hana', 'Youssef', 'hana.youssef@company.test', 'Finance Manager', 'Finance', '2022-03-01', 'employee'],
    ['Mark', 'Thompson', 'mark.thompson@company.test', 'Accountant', 'Finance', '2024-11-04', 'employee'],
    ['Laila', 'Samir', 'laila.samir@company.test', 'Backend Developer', 'Engineering', '2023-02-06', 'employee'],
  ];
  const employees: EmployeeRow[] = people.map(([first, last, email, title, department, hired, role], index) => ({
    id: index + 1,
    employee_code: `EMP-${String(index + 1).padStart(4, '0')}`,
    first_name: first,
    last_name: last,
    email,
    phone: `+1 555 01${String(index + 1).padStart(2, '0')}`,
    job_title: title,
    department,
    hire_date: hired,
    status: 'active',
    termination_date: null,
    role,
    password: 'password',
    last_login_at: stamp(addDays(today, -1), '08:55:00'),
  }));
  Object.assign(employees[15], { status: 'terminated', termination_date: `${year}-06-30`, last_login_at: null });

  const publicHolidays: HolidayRow[] = [year, year + 1]
    .flatMap((y) => [
      [`${y}-01-01`, "New Year's Day"],
      [`${y}-07-04`, 'Independence Day'],
      [thanksgiving(y), 'Thanksgiving Day'],
      [`${y}-12-25`, 'Christmas Day'],
    ])
    .map(([date, name], index) => ({ id: index + 1, holiday_date: date, name }));
  const holidays = new Set(publicHolidays.map((h) => h.holiday_date));

  // A request covering the week of the next weekday holiday, to show holidays aren't counted.
  const nextHoliday = publicHolidays.find((h) => h.holiday_date >= addDays(today, 7) && !isWeekend(h.holiday_date))!.holiday_date;
  const weekday = parseDateKey(nextHoliday).getDay();
  const holidayWeek = { start: addDays(nextHoliday, 1 - weekday), end: addDays(nextHoliday, 5 - weekday) };

  // employee, type, dates, status, reason, reviewer comment
  const leaves: [number, LeaveType, { start: string; end: string }, LeaveStatus, string, string?][] = [
    [5, 'annual', workRange(`${lastMonth}-10`, 3), 'approved', 'Family visit', 'Have a good trip'],
    [5, 'annual', workRange(addDays(today, 7), 5), 'pending', 'Vacation'],
    [5, 'annual', workRange(addDays(today, 30), 2), 'approved', 'Long weekend away', 'Approved'],
    [7, 'annual', workRange(addDays(today, -1), 3), 'approved', 'Moving apartments'],
    [6, 'annual', holidayWeek, 'pending', 'Family holiday'],
    [11, 'annual', workRange(addDays(today, 3), 2), 'rejected', 'Short break', 'Quarter-end — please pick another week'],
    [8, 'sick', workRange(`${lastMonth}-05`, 2), 'approved', 'Flu'],
    [12, 'sick', workRange(addDays(today, -2), 1), 'pending', 'Fever — reported after the fact'],
    [9, 'annual', workRange(addDays(today, 5), 1), 'cancelled', 'Appointment'],
    [3, 'annual', workRange(addDays(today, 10), 3), 'pending', 'Visiting parents'],
    [2, 'annual', workRange(addDays(today, 21), 2), 'pending', 'Long weekend'],
  ];
  const leaveRequests: LeaveRequestRow[] = leaves
    // Keep the demo valid in early January, when "last month" is in the previous year.
    .filter(([, , range]) => range.start.slice(0, 4) === range.end.slice(0, 4))
    .map(([employeeId, type, range, status, reason, comment], index) => {
      const reviewed = status === 'approved' || status === 'rejected';
      // Unplanned leave reported after the fact was submitted today; everything else a week ahead.
      const submitted = range.start < today && status === 'pending' ? today : addDays(range.start < today ? range.start : today, -7);
      return {
        id: index + 1,
        employee_id: employeeId,
        type,
        start_date: range.start,
        end_date: range.end,
        days: workingDaysBetween(range.start, range.end, holidays),
        reason,
        status,
        reviewed_by: reviewed ? (employeeId === 2 ? 3 : 2) : null,
        review_comment: comment ?? null,
        reviewed_at: reviewed ? stamp(addDays(submitted, 1), '11:30:00') : null,
        created_at: stamp(submitted, '09:40:00'),
      };
    });

  return { employees, auth_tokens: [], leave_requests: leaveRequests, public_holidays: publicHolidays };
}
