import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import Link from 'next/link';
import { auth } from '@/lib/auth';
import Providers from './providers';
import SignInButton from '@/components/SignInButton';
import UserMenu from '@/components/UserMenu';
import ThemeToggle from '@/components/ThemeToggle';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Keyboard Command Center',
  description: 'The comprehensive keyboard shortcut database for power users.',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Server-side session read so the header renders correctly without a client flash
  const session = await auth();

  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <Providers>
          <header className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-gray-200 dark:border-gray-800">
            <Link
              href="/"
              className="text-xl font-bold text-gray-900 dark:text-gray-100 hover:opacity-80 transition-opacity"
            >
              Keyboard Command Center
            </Link>
            <div className="flex items-center gap-3">
              <ThemeToggle />
              {session?.user ? <UserMenu /> : <SignInButton />}
            </div>
          </header>
          {children}
        </Providers>
      </body>
    </html>
  );
}
