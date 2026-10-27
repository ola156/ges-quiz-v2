import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@clerk/nextjs/server';
import { db } from '../../../lib/supabase';
import { getMember } from '../../../lib/member';
import { practiceSubjects } from '../../../lib/practice';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Leaderboard | Instrict Quizmate', robots: { index: false, follow: false } };

const DAY = 86400000;

// Most correct answers in custom practice, by subject, this week or all time. Names come from sign-up.
export default async function Board({ searchParams }) {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');
  const member = await getMember(userId);
  if (!member) redirect('/onboarding');

  const [subjects, sp] = await Promise.all([practiceSubjects(member.track, member.school), searchParams]);
  const key = subjects.find((s) => s.key === sp?.subject)?.key || subjects[0]?.key || '';
  const period = sp?.period === 'all' ? 'all' : 'week';
  const base = `/practice/leaderboard?subject=${encodeURIComponent(key)}`;

  let rows = [];
  let mine = null;
  if (key) {
    const since = period === 'all' ? '1970-01-01T00:00:00Z' : new Date(Date.now() - 7 * DAY).toISOString();
    const { data } = await db().rpc('practice_board', { p_track: member.track, p_subject: key, p_since: since, p_limit: 50 });
    rows = data || [];
    if (!rows.some((r) => r.clerk_id === userId)) {
      const { data: own } = await db().from('practice_attempts').select('correct, total')
        .eq('clerk_id', userId).eq('track', member.track).eq('subject', key).gte('created_at', since).limit(1000);
      if (own?.length) mine = { correct: own.reduce((n, r) => n + r.correct, 0), total: own.reduce((n, r) => n + r.total, 0), attempts: own.length };
    }
  }

  return (
    <div className="stack">
      <Link href={`/practice/custom?subject=${encodeURIComponent(key)}`} className="back">Back to custom practice</Link>
      <h1>Leaderboard</h1>
      {!subjects.length ? (
        <p className="muted">No practice questions are ready for your exam yet.</p>
      ) : (
        <>
          <div className="chips">
            {subjects.map((s) => (
              <Link key={s.key} href={`/practice/leaderboard?subject=${encodeURIComponent(s.key)}&period=${period}`} className={`chip ${s.key === key ? 'on' : ''}`} style={s.key === key ? { fontWeight: 700, borderColor: 'var(--link)' } : undefined}>{s.name}</Link>
            ))}
          </div>
          <div className="row">
            <Link href={`${base}&period=week`} className={`btn sm ${period === 'week' ? '' : 'ghost'}`}>This week</Link>
            <Link href={`${base}&period=all`} className={`btn sm ${period === 'all' ? '' : 'ghost'}`}>All time</Link>
          </div>
          <p className="muted small">Ranked by correct answers in custom practice. More practice moves you up.</p>

          {!rows.length ? (
            <p className="muted">Nobody has practised this subject {period === 'week' ? 'this week' : 'yet'}. Be the first.</p>
          ) : (
            <ol className="slist">
              {rows.map((r, i) => {
                const me = r.clerk_id === userId;
                const pct = r.total ? Math.round((Number(r.correct) / Number(r.total)) * 100) : 0;
                return (
                  <li key={r.clerk_id}>
                    <div className="srow" style={me ? { background: 'var(--wash)' } : undefined}>
                      <span className="n">{i + 1}</span>
                      <span className="t">{r.display_name || 'Student'}{me ? ' (you)' : ''}<small>{Number(r.attempts)} practice{Number(r.attempts) === 1 ? '' : 's'}, {pct}% right</small></span>
                      <span className="m"><strong>{Number(r.correct)}</strong> correct</span>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
          {mine && <p className="card small">You: {mine.correct} correct in {mine.attempts} practice{mine.attempts === 1 ? '' : 's'}. Keep going to reach the top 50.</p>}
          <Link href={`/practice/custom?subject=${encodeURIComponent(key)}`} className="btn">Practise {subjects.find((s) => s.key === key)?.name || ''}</Link>
        </>
      )}
    </div>
  );
}