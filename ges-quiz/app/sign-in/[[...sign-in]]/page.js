import Link from 'next/link';
import { SignIn } from '@clerk/nextjs';
import SiteHeader from '../../../components/SiteHeader';

export const metadata = { title: 'Sign in | Instrict Quizmate' };

export default function SignInPage() {
  return (
    <div className="lp">
      <SiteHeader />
      <div className="auth">
        <SignIn forceRedirectUrl="/dashboard" signUpUrl="/sign-up" />
        <p className="lp-aside">
          Opening a quiz from a code or a link? You do not need an account. <Link href="/">Go to the code box</Link>.
        </p>
      </div>
    </div>
  );
}
