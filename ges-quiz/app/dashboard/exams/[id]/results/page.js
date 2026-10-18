import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { auth } from '@clerk/nextjs/server';
import ExamResults from '../../../../../components/ExamResults';
import { db } from '../../../../../lib/supabase';
import { getMember } from '../../../../../lib/member';
import { examState } from '../../../../../lib/exam';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Results | Instrict Quizmate', robots: { index: false, follow: false } };

export default async function ExamResultsPage({ params }) {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');
  const member = await getMember(userId);
  if (!member || member.role !== 'tutor') redirect('/dashboard');

  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { data: exam } = await db()
    .from('quizzes')
    .select('id, title, track, opens_at, closes_at')
    .eq('id', id).eq('tutor_id', userId).maybeSingle();
  if (!exam) notFound();

  const state = examState(exam);
  return (
    <div className="stack">
      <Link href="/dashboard/results" className="back">Back to results</Link>
      <h1>{exam.title}</h1>
      <div className="row">
        <span className="chip">{state === 'open' ? 'Open' : state === 'scheduled' ? 'Not open yet' : 'Closed'}</span>
        <Link href={`/dashboard/exams/${exam.id}`} className="text-link">Manage this exam</Link>
      </div>
      <ExamResults examId={exam.id} title={exam.title} track={exam.track} />
    </div>
  );
}