import type { Role } from '../api/types';

export interface NavItem {
  label: string;
  path: string;
  /** true = shown to HR only. */
  hrOnly?: boolean;
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

// Sidebar menu. Route access is defined in App.tsx.
export const navigation: NavSection[] = [
  {
    title: 'Me',
    items: [
      { label: 'Dashboard', path: '/' },
      { label: 'My leave', path: '/my-leave' },
      { label: 'Public holidays', path: '/holidays' },
    ],
  },
  {
    title: 'HR',
    items: [
      { label: 'Employees', path: '/employees', hrOnly: true },
      { label: 'Leave requests', path: '/leave-requests', hrOnly: true },
    ],
  },
];

export function navigationFor(role: Role): NavSection[] {
  return navigation
    .map((section) => ({ ...section, items: section.items.filter((item) => !item.hrOnly || role === 'hr') }))
    .filter((section) => section.items.length > 0);
}
