'use server';

import { revalidatePath } from 'next/cache';
import bcrypt from 'bcryptjs';
import { getAppSession } from '@/lib/session';
import { hasPermission } from '@/lib/auth';
import { PERMISSIONS } from '@/lib/permissions';
import { prisma } from '@/lib/db';
import { writeAuditLog } from '@/lib/audit';

function requireManageUsers(session: Awaited<ReturnType<typeof getAppSession>>) {
  if (!session || !hasPermission(session, PERMISSIONS.MANAGE_USERS)) {
    throw new Error('You do not have permission to manage users.');
  }
  return session;
}

export async function createUserAction(formData: FormData) {
  const session = requireManageUsers(await getAppSession());

  const email = String(formData.get('email')).toLowerCase().trim();
  const name = String(formData.get('name')).trim();
  const roleId = String(formData.get('roleId'));
  const password = String(formData.get('password'));

  if (!email || !name || !roleId || password.length < 8) {
    throw new Error('Please fill in all fields — password must be at least 8 characters.');
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({ data: { email, name, roleId, passwordHash } });

  await writeAuditLog({ userId: session.user.id, action: 'CREATE', entity: 'User', recordId: user.id, newValue: { email, name, roleId } });
  revalidatePath('/admin/users');
}

export async function toggleUserStatusAction(formData: FormData) {
  const session = requireManageUsers(await getAppSession());
  const userId = String(formData.get('userId'));

  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const nextStatus = user.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE';
  await prisma.user.update({ where: { id: userId }, data: { status: nextStatus } });

  await writeAuditLog({ userId: session.user.id, action: 'UPDATE', entity: 'User', recordId: userId, oldValue: { status: user.status }, newValue: { status: nextStatus } });
  revalidatePath('/admin/users');
}
