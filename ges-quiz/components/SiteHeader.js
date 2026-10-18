import Link from 'next/link';
import { auth } from '@clerk/nextjs/server';
import { UserButton } from '@clerk/nextjs';
import { BRAND } from '../lib/brand';
import ThemeToggle from './ThemeToggle';

export default async function SiteHeader() {
  const { userId } = await auth();
  return (
    <header className="lp-head">
      <Link href="/" className="lp-mark" aria-label={`${BRAND} home`}>
        Instrict <span>Quizmate</span>
      </Link>
      <nav className="lp-nav" aria-label="Main">
        <Link href="/browse" className="lp-hide-sm">Practice sets</Link>
        {userId ? (
          <>
            <Link href="/dashboard">Dashboard</Link>
            <UserButton afterSignOutUrl="/" />
          </>
        ) : (
          <>
            <Link href="/sign-in" className="lp-signin">Sign in</Link>
            <Link href="/sign-up" className="btn sm">Get started</Link>
          </>
        )}
        <ThemeToggle />
      </nav>
    </header>
  );
}
