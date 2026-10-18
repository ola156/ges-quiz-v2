import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@clerk/nextjs/server';
import ExamEditor from '../../../../components/ExamEditor';
import { getMember, getTutorAccount, tutorStatus, tutorReady } from '../../../../lib/member';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'New exam | Instrict Quizmate', robots: { index: false, follow: false } };

export default async function NewExam() {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');
  const member = await getMember(userId);
  if (!member) redirect('/onboarding');
  if (member.role !== 'tutor') redirect('/dashboard');
  const status = tutorStatus(await getTutorAccount(userId));
  if (status !== 'active' && status !== 'trial') redirect('/dashboard');
  if (!tutorReady(member)) redirect('/onboarding?edit=1');

  return (
    <div className="stack">
        <Link href="/dashboard" className="back">Back to dashboard</Link>
        <h1>New exam</h1>
        {status === 'trial' && <p className="card small">This is your free session. After it, your account needs activating.</p>}
        <ExamEditor scope={{ tracks: member.tracks || [], schools: member.schools || [] }} />
    </div>
  );
}