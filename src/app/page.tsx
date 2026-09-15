import { redirect } from 'next/navigation';
import { getAppSession } from '@/lib/session';

export default async function RootPage() {
  const session = await getAppSession();
  redirect(session ? '/overview' : '/login');
}
