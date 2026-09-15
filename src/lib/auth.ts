import type { AuthOptions, Session } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/db';
import type { PermissionKey } from '@/lib/permissions';

export const authOptions: AuthOptions = {
  session: { strategy: 'jwt', maxAge: 8 * 60 * 60 }, // 8 hour session
  pages: { signIn: '/login' },
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await prisma.user.findUnique({
          where: { email: credentials.email.toLowerCase().trim() },
          include: { role: { include: { permissions: { include: { permission: true } } } } }
        });

        if (!user || user.status !== 'ACTIVE') return null;

        const valid = await bcrypt.compare(credentials.password, user.passwordHash);
        if (!valid) return null;

        await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          roleName: user.role.name,
          permissions: user.role.permissions.map((rp) => rp.permission.key)
        } as any;
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.userId = (user as any).id;
        token.roleName = (user as any).roleName;
        token.permissions = (user as any).permissions;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.userId;
        (session.user as any).roleName = token.roleName;
        (session.user as any).permissions = token.permissions;
      }
      return session;
    }
  }
};

export type AppSession = Session & {
  user: {
    id: string;
    name: string;
    email: string;
    roleName: string;
    permissions: PermissionKey[];
  };
};

export function hasPermission(session: AppSession | null, key: PermissionKey): boolean {
  if (!session) return false;
  return session.user.permissions?.includes(key) ?? false;
}
