import type { PermissionKey } from '@/lib/permissions';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      name: string;
      email: string;
      roleName: string;
      permissions: PermissionKey[];
    };
  }

  interface User {
    id: string;
    roleName: string;
    permissions: PermissionKey[];
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    userId: string;
    roleName: string;
    permissions: PermissionKey[];
  }
}
