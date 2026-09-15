import { PERMISSIONS, type PermissionKey } from '@/lib/permissions';

export type NavItem = {
  label: string;
  href: string;
  permission: PermissionKey;
  future?: boolean;
};

export type NavGroup = {
  title: string;
  items: NavItem[];
};

// Mirrors spec section 29 (Application Navigation). Items marked
// `future: true` route to /coming-soon instead of a real dashboard — no
// fake pages, per spec section 43/48.
export const NAV_GROUPS: NavGroup[] = [
  {
    title: 'Overview',
    items: [{ label: 'Management Overview', href: '/overview', permission: PERMISSIONS.VIEW_OVERVIEW }]
  },
  {
    title: 'Custody',
    items: [{ label: 'Agent Custody Search', href: '/custody', permission: PERMISSIONS.VIEW_AGENT_CUSTODY }]
  },
  {
    title: 'Warehouse',
    items: [
      { label: 'Warehouse POS', href: '/warehouse/pos', permission: PERMISSIONS.VIEW_WAREHOUSE },
      { label: 'Warehouse Materials', href: '/warehouse/materials', permission: PERMISSIONS.VIEW_WAREHOUSE }
    ]
  },
  {
    title: 'Performance',
    items: [
      { label: 'Agent Performance', href: '/coming-soon?m=Agent%20Performance', permission: PERMISSIONS.VIEW_PERFORMANCE, future: true },
      { label: 'Live Ops', href: '/coming-soon?m=Live%20Ops%20Performance', permission: PERMISSIONS.VIEW_PERFORMANCE, future: true },
      { label: 'Team Leader', href: '/coming-soon?m=Team%20Leader%20%2F%20Supervisor', permission: PERMISSIONS.VIEW_PERFORMANCE, future: true },
      { label: 'Deployment', href: '/coming-soon?m=Deployment%20Performance', permission: PERMISSIONS.VIEW_PERFORMANCE, future: true },
      { label: 'Cancellation', href: '/coming-soon?m=Cancellation%20Performance', permission: PERMISSIONS.VIEW_PERFORMANCE, future: true }
    ]
  },
  {
    title: 'Field Operations',
    items: [
      { label: 'Failed Attempts', href: '/coming-soon?m=Failed%20Attempts', permission: PERMISSIONS.VIEW_PERFORMANCE, future: true },
      { label: 'Replacement', href: '/coming-soon?m=Replacement', permission: PERMISSIONS.VIEW_PERFORMANCE, future: true },
      { label: 'Attendance', href: '/coming-soon?m=Attendance%20%2F%20Field%20Activity', permission: PERMISSIONS.VIEW_PERFORMANCE, future: true },
      { label: 'Maintenance', href: '/coming-soon?m=Maintenance', permission: PERMISSIONS.VIEW_PERFORMANCE, future: true },
      { label: 'Logistics', href: '/coming-soon?m=Logistics', permission: PERMISSIONS.VIEW_PERFORMANCE, future: true },
      { label: 'FSM', href: '/coming-soon?m=FSM', permission: PERMISSIONS.VIEW_PERFORMANCE, future: true }
    ]
  },
  {
    title: 'Finance / Closing',
    items: [
      { label: 'Payroll', href: '/coming-soon?m=Payroll', permission: PERMISSIONS.VIEW_PAYROLL, future: true },
      { label: 'Monthly Closing', href: '/coming-soon?m=Monthly%20Closing', permission: PERMISSIONS.VIEW_BUDGET, future: true },
      { label: 'Budget', href: '/coming-soon?m=Budget%20%2F%20Cost%20Control', permission: PERMISSIONS.VIEW_BUDGET, future: true },
      { label: 'Rents & Petty Cash', href: '/coming-soon?m=Rents%20%26%20Petty%20Cash', permission: PERMISSIONS.VIEW_BUDGET, future: true }
    ]
  },
  {
    title: 'Data Management',
    items: [{ label: 'Imports & Sync History', href: '/data-management', permission: PERMISSIONS.VIEW_DATA_MANAGEMENT }]
  },
  {
    title: 'Administration',
    items: [
      { label: 'Agent Master', href: '/admin/agents', permission: PERMISSIONS.MANAGE_AGENTS },
      { label: 'Users & Roles', href: '/admin/users', permission: PERMISSIONS.MANAGE_USERS },
      { label: 'Audit Log', href: '/admin/audit-log', permission: PERMISSIONS.VIEW_AUDIT_LOG }
    ]
  }
];
