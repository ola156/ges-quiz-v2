import Link from 'next/link';
import { auth } from '@clerk/nextjs/server';
import { UserButton } from '@clerk/nextjs';
import NavFrame from './NavFrame';
import ThemeToggle from './ThemeToggle';
import HelpLink from './HelpLink';
import { getMember } from '../lib/member';

const HOME = 'M3 11l9-8 9 8 M5 10v10h14V10';
const BOOK = 'M4 4h6a3 3 0 013 3v13a2 2 0 00-2-2H4z M20 4h-6a3 3 0 00-3 3v13a2 2 0 012-2h7z';
const LIST = 'M4 6h16 M4 12h16 M4 18h16';
const PLUS = 'M12 5v14 M5 12h14';
const USER = 'M12 12a4 4 0 100-8 4 4 0 000 8z M4 21c0-4 4-6 8-6s8 2 8 6';
const CHART = 'M4 20V10 M10 20V4 M16 20v-8 M22 20H2';
const TARGET = 'M12 21a9 9 0 100-18 9 9 0 000 18z M12 16a4 4 0 100-8 4 4 0 000 8z M12 12h.01';

const ITEMS = {
  student: [
    { id: 'home', href: '/dashboard', label: 'Home', icon: HOME, exact: true },
    { id: 'study', href: '/study', label: 'Study', icon: BOOK },
    { id: 'practice', href: '/practice', label: 'Practice', icon: TARGET },
    { id: 'profile', href: '/profile', label: 'Profile', icon: USER },
  ],
  tutor: [
    { id: 'home', href: '/dashboard', label: 'Home', icon: HOME, exact: true },
    { id: 'exams', href: '/dashboard/exams', label: 'My exams', icon: LIST, match: ['/dashboard/exams'], except: ['/dashboard/exams/new'] },
    { id: 'results', href: '/dashboard/results', label: 'Results', icon: CHART },
    { id: 'new', href: '/dashboard/exams/new', label: 'New exam', icon: PLUS, exact: true },
    { id: 'profile', href: '/profile', label: 'Profile', icon: USER },
  ],
};

// The frame around every signed-in page: a side menu on wide screens, a bottom bar and a sliding menu on phones.
export default async function AppFrame({ children }) {
  const { userId } = await auth();
  const member = userId ? await getMember(userId) : null;
  const role = member?.role === 'tutor' ? 'tutor' : 'student';

  const brand = <Link href="/" className="nf-brand" aria-label="Instrict Quizmate home">Instrict <span>Quizmate</span></Link>;
  return (
    <NavFrame
      items={ITEMS[role]}
      brand={brand}
      footer={<HelpLink where="in-menu" />}
      tools={<><ThemeToggle /><UserButton afterSignOutUrl="/" /></>}
    >
      {children}
    </NavFrame>
  );
}