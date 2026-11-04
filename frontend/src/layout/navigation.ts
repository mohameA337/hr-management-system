import type { Role } from '../api/types';

export interface NavItem {
  label: string;
  path: string;
  roles: Role[];
  /** Backend phase from docs/API.md section 5 that this screen depends on. */
  phase: number;
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

const ALL: Role[] = ['admin', 'hr', 'manager', 'employee'];
const STAFF: Role[] = ['admin', 'hr'];
const LEADS: Role[] = ['admin', 'hr', 'manager'];

// Single source of truth for the sidebar and the role-protected routes.
export const navigation: NavSection[] = [
  {
    title: 'Me',
    items: [
      { label: 'Dashboard', path: '/', roles: ALL, phase: 7 },
      { label: 'My profile', path: '/me', roles: ALL, phase: 3 },
      { label: 'My leave', path: '/me/leave', roles: ALL, phase: 4 },
      { label: 'My attendance', path: '/me/attendance', roles: ALL, phase: 5 },
      { label: 'My payslips', path: '/me/payslips', roles: ALL, phase: 6 },
    ],
  },
  {
    title: 'People',
    items: [
      { label: 'Employees', path: '/employees', roles: LEADS, phase: 3 },
      { label: 'Leave requests', path: '/leave-requests', roles: LEADS, phase: 4 },
      { label: 'Attendance', path: '/attendance', roles: LEADS, phase: 5 },
    ],
  },
  {
    title: 'Organization',
    items: [
      { label: 'Departments', path: '/departments', roles: STAFF, phase: 1 },
      { label: 'Positions', path: '/positions', roles: STAFF, phase: 3 },
      { label: 'Leave types', path: '/leave-types', roles: STAFF, phase: 4 },
      { label: 'Payroll', path: '/payroll', roles: STAFF, phase: 6 },
    ],
  },
  {
    title: 'Administration',
    items: [
      { label: 'Users', path: '/users', roles: ['admin'], phase: 2 },
      { label: 'Settings', path: '/settings', roles: ['admin'], phase: 5 },
    ],
  },
];

export function navigationFor(role: Role): NavSection[] {
  return navigation
    .map((section) => ({ ...section, items: section.items.filter((item) => item.roles.includes(role)) }))
    .filter((section) => section.items.length > 0);
}
