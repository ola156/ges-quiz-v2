import { auth } from '@clerk/nextjs/server';
import AppFrame from '../../components/AppFrame';

export const dynamic = 'force-dynamic';

// Signed-in people get the app frame. Visitors without an account still see the list, on a plain page.
export default async function Layout({ children }) {
  const { userId } = await auth();
  return userId ? <AppFrame>{children}</AppFrame> : <main className="wrap">{children}</main>;
}