import type { Metadata } from 'next';
import './globals.css';
import { AuthSessionProvider } from '@/components/layout/SessionProvider';

export const metadata: Metadata = {
  title: 'Operations Control System',
  description: 'Internal operations platform — Custody, Warehouse, and future operational modules.'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AuthSessionProvider>{children}</AuthSessionProvider>
      </body>
    </html>
  );
}
