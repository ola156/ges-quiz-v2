import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { auth } from '@clerk/nextjs/server';
import Bar from '../../../../components/Bar';
import { flatten, getProgress, getSubject, isDone } from '../../../../lib/study';
import { getMember } from '../../../../lib/member';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Study | Instrict Quizmate', robots: { index: false, follow: false } };

export default async function SubjectPage({ params }) {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');
  const { exam, subject: id } = await params;
  const member = await getMember(userId);
  const subject = await getSubject(exam, id, member?.school);
  if (!subject) notFound();

  const progress = await getProgress(userId);
  const all = flatten(subject);
  const done = all.filter((x) => isDone(progress[x.id])).length;
  // Continue where the student left off: the first lesson that is not done yet.
  const resume = all.find((x) => !isDone(progress[x.id]));

  return (
    <div className="stack">
      <Link href="/study" className="back">Back to study</Link>
      <h1>{subject.name}</h1>
      <div className="stack tight">
        <Bar value={(done / all.length) * 100} label="Overall progress" />
        <span className="sbar-note">{done} of {all.length} lessons done</span>
      </div>
      {resume && (
        <Link href={`/study/${exam}/${id}/${resume.id}`} className="btn">{done ? 'Continue' : 'Start'}: {resume.title}</Link>
      )}

      <ol className="slist">
        {subject.topics.map((t, k) => (
          <li key={t.id}>
            <Link href={`/study/${exam}/${id}/topic/${t.id}`} className="srow go">
              <span className="n">{k + 1}</span>
              <span className="t">{t.title}</span>
            </Link>
          </li>
        ))}
      </ol>
    </div>
  );
}