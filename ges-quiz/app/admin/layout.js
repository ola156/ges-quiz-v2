import { notFound, redirect } from 'next/navigation';
import { auth } from '@clerk/nextjs/server';
import { adminIds } from '../../lib/admin';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Admin', robots: { index: false, follow: false } };

// Only the people listed in ADMIN_CLERK_IDS get past this. Signed out: go and sign in.
// Signed in as anyone else: the page does not exist.
export default async function AdminLayout({ children }) {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in?redirect_url=/admin');
  if (!adminIds().includes(userId)) notFound();
  return children;
}