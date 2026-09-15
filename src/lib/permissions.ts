/**
 * Capability-based permissions (spec section 33).
 *
 * Every permission check in the app calls hasPermission(session, KEY)
 * instead of checking role names directly, so role -> permission mapping
 * lives in ONE place (the database, seeded from ROLE_PERMISSION_SEED below)
 * and nowhere else. Adding a new role or a new page never requires
 * touching scattered `if (role === 'Admin')` checks.
 */

export const PERMISSIONS = {
  VIEW_OVERVIEW: 'view_overview',
  VIEW_AGENT_CUSTODY: 'view_agent_custody',
  VIEW_WAREHOUSE: 'view_warehouse',
  VIEW_PERFORMANCE: 'view_performance',
  VIEW_PAYROLL: 'view_payroll',
  MANAGE_PAYROLL: 'manage_payroll',
  VIEW_BUDGET: 'view_budget',
  MANAGE_BUDGET: 'manage_budget',
  MANAGE_IMPORTS: 'manage_imports',
  VIEW_DATA_MANAGEMENT: 'view_data_management',
  MANAGE_AGENTS: 'manage_agents',
  MANAGE_USERS: 'manage_users',
  VIEW_AUDIT_LOG: 'view_audit_log',
  EXPORT_DATA: 'export_data',
  EXPORT_SENSITIVE_DATA: 'export_sensitive_data'
} as const;

export type PermissionKey = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const PERMISSION_CATALOG: Array<{ key: PermissionKey; label: string; category: string }> = [
  { key: PERMISSIONS.VIEW_OVERVIEW, label: 'View management overview', category: 'Overview' },
  { key: PERMISSIONS.VIEW_AGENT_CUSTODY, label: 'View Agent Custody Search', category: 'Custody' },
  { key: PERMISSIONS.VIEW_WAREHOUSE, label: 'View Warehouse dashboards', category: 'Warehouse' },
  { key: PERMISSIONS.VIEW_PERFORMANCE, label: 'View performance dashboards (future)', category: 'Performance' },
  { key: PERMISSIONS.VIEW_PAYROLL, label: 'View payroll (future)', category: 'Finance' },
  { key: PERMISSIONS.MANAGE_PAYROLL, label: 'Manage payroll (future)', category: 'Finance' },
  { key: PERMISSIONS.VIEW_BUDGET, label: 'View budget (future)', category: 'Finance' },
  { key: PERMISSIONS.MANAGE_BUDGET, label: 'Manage budget (future)', category: 'Finance' },
  { key: PERMISSIONS.MANAGE_IMPORTS, label: 'Upload / run data imports', category: 'Data Management' },
  { key: PERMISSIONS.VIEW_DATA_MANAGEMENT, label: 'View import & sync history', category: 'Data Management' },
  { key: PERMISSIONS.MANAGE_AGENTS, label: 'Manage Agent Master', category: 'Administration' },
  { key: PERMISSIONS.MANAGE_USERS, label: 'Manage users & roles', category: 'Administration' },
  { key: PERMISSIONS.VIEW_AUDIT_LOG, label: 'View audit log', category: 'Administration' },
  { key: PERMISSIONS.EXPORT_DATA, label: 'Export dashboard data (Excel/CSV)', category: 'Data Management' },
  { key: PERMISSIONS.EXPORT_SENSITIVE_DATA, label: 'Export payroll/budget/financial data', category: 'Finance' }
];

/** Seed mapping of default roles -> permissions. Editable later from Administration > Roles. */
export const ROLE_PERMISSION_SEED: Record<string, PermissionKey[]> = {
  Admin: PERMISSION_CATALOG.map((p) => p.key),
  Management: [
    PERMISSIONS.VIEW_OVERVIEW,
    PERMISSIONS.VIEW_AGENT_CUSTODY,
    PERMISSIONS.VIEW_WAREHOUSE,
    PERMISSIONS.VIEW_PERFORMANCE,
    PERMISSIONS.VIEW_DATA_MANAGEMENT,
    PERMISSIONS.VIEW_AUDIT_LOG,
    PERMISSIONS.EXPORT_DATA
  ],
  Operations: [PERMISSIONS.VIEW_AGENT_CUSTODY, PERMISSIONS.VIEW_WAREHOUSE, PERMISSIONS.EXPORT_DATA],
  Warehouse: [PERMISSIONS.VIEW_WAREHOUSE, PERMISSIONS.MANAGE_IMPORTS, PERMISSIONS.VIEW_DATA_MANAGEMENT, PERMISSIONS.EXPORT_DATA],
  LiveOps: [PERMISSIONS.VIEW_AGENT_CUSTODY, PERMISSIONS.VIEW_PERFORMANCE],
  Payroll: [PERMISSIONS.VIEW_PAYROLL, PERMISSIONS.MANAGE_PAYROLL, PERMISSIONS.EXPORT_SENSITIVE_DATA],
  Finance: [PERMISSIONS.VIEW_BUDGET, PERMISSIONS.MANAGE_BUDGET, PERMISSIONS.EXPORT_SENSITIVE_DATA],
  'Read Only': [PERMISSIONS.VIEW_OVERVIEW, PERMISSIONS.VIEW_AGENT_CUSTODY, PERMISSIONS.VIEW_WAREHOUSE]
};
