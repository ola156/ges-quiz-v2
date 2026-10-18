import Link from 'next/link';
import { SignUp } from '@clerk/nextjs';
import SiteHeader from '../../../components/SiteHeader';

export const metadata = { title: 'Create an account | Instrict Quizmate' };

export default async function SignUpPage({ searchParams }) {
  const { role } = await searchParams;
  // Only these two values are ever passed on.
  const safeRole = role === 'tutor' ? 'tutor' : role === 'student' ? 'student' : '';
  const next = safeRole ? `/onboarding?role=${safeRole}` : '/onboarding';
  return (
    <div className="lp">
      <SiteHeader />
      <div className="auth">
        <SignUp forceRedirectUrl={next} signInUrl="/sign-in" />
        <p className="lp-aside">
          Opening a quiz from a code or a link? You do not need an account. <Link href="/">Go to the code box</Link>.
        </p>
      </div>
    </div>
  );
}
