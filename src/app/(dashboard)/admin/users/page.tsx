import { redirect } from 'next/navigation';
import { getAppSession } from '@/lib/session';
import { hasPermission } from '@/lib/auth';
import { PERMISSIONS } from '@/lib/permissions';
import { prisma } from '@/lib/db';
import { createUserAction, toggleUserStatusAction } from '@/lib/actions/userActions';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { EmptyState } from '@/components/ui/EmptyState';

export default async function UsersPage() {
  const session = await getAppSession();
  if (!session) return null;
  if (!hasPermission(session, PERMISSIONS.MANAGE_USERS)) {
    return <EmptyState title="You don't have access to manage users." />;
  }

  const [users, roles] = await Promise.all([
    prisma.user.findMany({ include: { role: true }, orderBy: { createdAt: 'asc' } }),
    prisma.role.findMany({ orderBy: { name: 'asc' } })
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-navy-900">Users & Roles</h1>
        <p className="text-sm text-slate-500">Create accounts and assign roles. Permissions are managed per role, not per user.</p>
      </div>

      <section className="card p-4">
        <h2 className="section-title mb-3">Add User</h2>
        <form action={createUserAction} className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs text-slate-500 mb-1">Full name</label>
            <input name="name" required className="input-field w-48" />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Email</label>
            <input name="email" type="email" required className="input-field w-56" />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Role</label>
            <select name="roleId" required className="input-field w-40">
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Temporary password</label>
            <input name="password" type="password" required minLength={8} className="input-field w-48" />
          </div>
          <button type="submit" className="btn-primary">
            Create
          </button>
        </form>
      </section>

      <section className="card overflow-x-auto">
        <table className="table-base">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Status</th>
              <th>Last Login</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>{u.name}</td>
                <td>{u.email}</td>
                <td>{u.role.name}</td>
                <td>
                  <StatusBadge status={u.status} />
                </td>
                <td>{u.lastLoginAt ? new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium' }).format(u.lastLoginAt) : 'Never'}</td>
                <td>
                  <form action={toggleUserStatusAction}>
                    <input type="hidden" name="userId" value={u.id} />
                    <button type="submit" className="btn-secondary text-xs py-1 px-2">
                      {u.status === 'ACTIVE' ? 'Disable' : 'Enable'}
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

