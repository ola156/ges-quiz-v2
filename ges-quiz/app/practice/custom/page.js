import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@clerk/nextjs/server';
import PracticeRunner from '../../../components/PracticeRunner';
import { getMember } from '../../../lib/member';
import { practiceSubjects } from '../../../lib/practice';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Custom practice | Instrict Quizmate', robots: { index: false, follow: false } };

// Build your own practice: pick a subject, how many questions, study or exam mode, and a timer.
export default async function CustomPractice({ searchParams }) {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');
  const member = await getMember(userId);
  if (!member) redirect('/onboarding');
  if (member.role === 'tutor') redirect('/dashboard');

  const [subjects, sp] = await Promise.all([practiceSubjects(member.track, member.school), searchParams]);
  return (
    <div className="stack">
      <Link href="/practice" className="back">Back to practice</Link>
      <h1>Custom practice</h1>
      <p className="muted small">Random questions from our question bank, set up your way.</p>
      <PracticeRunner subjects={subjects} start={typeof sp?.subject === 'string' ? sp.subject : ''} userName={member.display_name || ''} />
    </div>
  );
}