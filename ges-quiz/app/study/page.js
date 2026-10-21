import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@clerk/nextjs/server';
import { getMember, TRACKS } from '../../lib/member';
import MathText from '../../components/MathText';
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
  const number = String(process.env.NEXT_PUBLIC_CONTACT_WHATSAPP || '').replace(/\D/g, '');
  const text = `Hello, I would like to request a course on Instrict Quizmate study: `;
  const wa = number ? `https://wa.me/${number}?text=${encodeURIComponent(text)}` : '';

  return (
    <div className="stack">
        <h1>Study {TRACKS[track] || ''}</h1>
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
                    <span className="t"><MathText text={s.name} />{s.blurb ? <small><MathText text={s.blurb} /></small> : null}</span>
                    <span className="m">{done}/{all.length}</span>
                  </Link>
                </li>
              );
            })}
          </ol>
        )}

        <section className="card stack tight">
          <h2 className="card-h">Want your course added?</h2>
          <p className="muted small">Tell us the course or subject you want to study here and we will work on adding it.</p>
          {wa ? <a className="btn ghost" href={wa} target="_blank" rel="noreferrer">Reach out on WhatsApp</a> : <p className="small">Message us and ask for your course.</p>}
        </section>
    </div>
  );
}