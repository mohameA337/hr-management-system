// Shapes from docs/API.md. Keep in sync with the contract.

export type Role = 'admin' | 'hr' | 'manager' | 'employee';

export interface EmployeeSummary {
  id: number;
  employee_code: string;
  full_name: string;
}

export interface User {
  id: number;
  role: Role;
  is_active: boolean;
  last_login_at: string | null;
  employee: EmployeeSummary & { email: string };
}

export interface LoginResult {
  token: string;
  expires_at: string;
  user: User;
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
