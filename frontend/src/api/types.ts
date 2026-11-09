// Shapes from docs/API.md (v3.0). Keep in sync with the contract.

export type Role = 'hr' | 'employee';
export type EmployeeStatus = 'active' | 'terminated';
export type LeaveType = 'annual' | 'sick';
export type LeaveStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

export interface EmployeeSummary {
  id: number;
  employee_code: string;
  full_name: string;
}

/** Also the logged-in user: every employee is a login account. */
export interface Employee {
  id: number;
  employee_code: string;
  first_name: string;
  last_name: string;
  full_name: string;
  email: string;
  phone: string | null;
  job_title: string;
  department: string;
  hire_date: string;
  status: EmployeeStatus;
  termination_date: string | null;
  role: Role;
  last_login_at: string | null;
}

export interface LoginResult {
  token: string;
  expires_at: string;
  user: Employee;
}

/** One per leave type, including the type's rules. */
export interface LeaveBalance {
  type: LeaveType;
  name: string;
  year: number;
  days_per_year: number;
  used_days: number;
  remaining_days: number;
  /** Working days the start must be ahead of today (planned leave). */
  min_notice_days: number;
  /** Calendar days the start may be in the past (unplanned leave). */
  max_backdate_days: number;
}

export interface Me {
  user: Employee;
  leave_balances: LeaveBalance[];
}

export interface LeaveRequest {
  id: number;
  employee: EmployeeSummary;
  type: LeaveType;
  start_date: string;
  end_date: string;
  days: number;
  reason: string | null;
  status: LeaveStatus;
  reviewer: EmployeeSummary | null;
  review_comment: string | null;
  reviewed_at: string | null;
  created_at: string;
}

export interface Holiday {
  id: number;
  holiday_date: string;
  name: string;
}

export interface PaginationMeta {
  page: number;
  per_page: number;
  total: number;
  total_pages: number;
}

export interface Paginated<T> {
  data: T[];
  meta: PaginationMeta;
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: Record<string, string[]>;
  };
}
