import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@clerk/nextjs/server';
import { getMember } from '../../../lib/member';
import { db } from '../../../lib/supabase';
import { lagos } from '../../../lib/exam';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Results | Instrict Quizmate', robots: { index: false, follow: false } };

export default async function ResultsList() {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');
  const member = await getMember(userId);
  if (!member || member.role !== 'tutor') redirect('/dashboard');

  const { data: exams } = await db()
    .from('quizzes')
    .select('id, title, created_at, submissions(count)')
    .eq('tutor_id', userId)
    .order('created_at', { ascending: false });

  return (
    <div className="stack">
      <h1>Results</h1>
      <p className="muted small">Pick an exam to see how students did.</p>
      {!exams?.length && <p className="muted">No exams yet.</p>}
      <ol className="slist" style={{ listStyle: 'none', margin: 0, padding: 0, borderTop: '1px solid var(--surface-line)' }}>
        {(exams || []).map((x) => (
          <li key={x.id} style={{ borderBottom: '1px solid var(--surface-line)' }}>
            <Link href={`/dashboard/exams/${x.id}/results`} className="srow go">
              <span className="t">{x.title}<small>Created {lagos(x.created_at)}</small></span>
              <span className="m">{x.submissions?.[0]?.count ?? 0} handed in</span>
            </Link>
          </li>
        ))}
      </ol>
    </div>
  );
}