import { getServerSession } from 'next-auth';
import { authOptions, type AppSession } from '@/lib/auth';

export async function getAppSession(): Promise<AppSession | null> {
  const session = await getServerSession(authOptions);
  return session as AppSession | null;
}
