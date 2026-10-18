'use client';
import { usePathname } from 'next/navigation';

// The new pages use the full width. Every older page keeps the narrow column it always had.
const WIDE = ['/', '/sign-in', '/sign-up', '/onboarding', '/dashboard', '/study', '/profile', '/practice', '/admin'];

export default function Shell({ children }) {
  const path = usePathname() || '/';
  const wide = WIDE.some((p) => path === p || (p !== '/' && path.startsWith(p + '/')));
  return wide ? <div className="site">{children}</div> : <main className="wrap">{children}</main>;
}