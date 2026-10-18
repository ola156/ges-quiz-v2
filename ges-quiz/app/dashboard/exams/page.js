import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@clerk/nextjs/server';
import { getMember } from '../../../lib/member';
import { db } from '../../../lib/supabase';
import { examState, lagos } from '../../../lib/exam';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'My exams | Instrict Quizmate', robots: { index: false, follow: false } };

export default async function MyExams() {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');
  const member = await getMember(userId);
  if (!member || member.role !== 'tutor') redirect('/dashboard');

  const { data: exams } = await db()
    .from('quizzes')
    .select('id, slug, title, opens_at, closes_at, created_at, questions(count), submissions(count)')
    .eq('tutor_id', userId)
    .order('created_at', { ascending: false });

  return (
    <div className="stack">
      <div className="row between">
        <h1>My exams</h1>
        <Link href="/dashboard/exams/new" className="btn sm">New exam</Link>
      </div>
      {!exams?.length && <p className="muted">No exams yet.</p>}
      {(exams || []).map((x) => {
        const state = examState(x);
        return (
          <div key={x.id} className="card stack tight">
            <strong>{x.title}</strong>
            <div className="chips">
              <span className="chip">{state === 'open' ? 'Open' : state === 'scheduled' ? `Opens ${lagos(x.opens_at)}` : 'Closed'}</span>
              <span className="chip">{x.questions?.[0]?.count ?? 0} questions</span>
              <span className="chip">{x.submissions?.[0]?.count ?? 0} handed in</span>
              <span className="chip">Code: {x.slug}</span>
            </div>
            <div className="row">
              <Link href={`/dashboard/exams/${x.id}`} className="btn sm">Manage</Link>
              <Link href={`/dashboard/exams/${x.id}/results`} className="btn sm ghost">Results</Link>
            </div>
          </div>
        );
      })}
    </div>
  );
}