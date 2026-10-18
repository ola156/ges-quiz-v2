import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@clerk/nextjs/server';
import { getMember, TRACKS } from '../../lib/member';
import { flatten, getProgress, isDone, listSubjects } from '../../lib/study';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Study | Instrict Quizmate', robots: { index: false, follow: false } };

export default async function StudyHome() {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');
  const member = await getMember(userId);
  if (!member) redirect('/onboarding');
  if (member.role === 'tutor') redirect('/dashboard');

  const track = member.track;
  const subjects = await listSubjects(track, member.school);
  const progress = await getProgress(userId);

  return (
    <div className="stack">
        <h1>{ track === 'university' ? ' Available Courses' : 'Available Subjects' } </h1>
        {!subjects.length ? (
          <section className="card stack tight">
            <h2 className="card-h">{TRACKS[track] || 'Your exam'} study is being prepared</h2>
            <p className="muted small">
              {track === 'university'
                ? 'Course quizzes with leaderboards are ready now.'
                : 'JAMB is being built first. Your exam is next.'}
            </p>
            {track === 'university' && <Link href="/practice" className="btn">Open practice sets</Link>}
            <Link href="/onboarding?edit=1" className="text-link">Change my exam</Link>
          </section>
        ) : (
          <ol className="slist">
            {subjects.map((s, k) => {
              const all = flatten(s);
              const done = all.filter((x) => isDone(progress[x.id])).length;
              return (
                <li key={s.id}>
                  <Link href={`/study/${s.exam}/${s.id}`} className="srow go">
                    <span className="n">{k + 1}</span>
                    <span className="t">{s.name}{s.blurb ? <small>{s.blurb}</small> : null}</span>
                    <span className="m">{done}/{all.length}</span>
                  </Link>
                </li>
              );
            })}
          </ol>
        )}
    </div>
  );
}