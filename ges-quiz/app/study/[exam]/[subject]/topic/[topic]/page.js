import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { auth } from '@clerk/nextjs/server';
import MathText from '../../../../../../components/MathText';
import { getProgress, getSubject, isDone } from '../../../../../../lib/study';
import { getMember } from '../../../../../../lib/member';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Study | Instrict Quizmate', robots: { index: false, follow: false } };

export default async function TopicPage({ params }) {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');
  const { exam, subject: id, topic } = await params;
  const member = await getMember(userId);
  const subject = await getSubject(exam, id, member?.school);
  const t = subject?.topics.find((x) => x.id === topic);
  if (!t) notFound();

  const progress = await getProgress(userId);

  return (
    <div className="stack">
      <Link href={`/study/${exam}/${id}`} className="back">Back to <MathText text={subject.name} /></Link>
      <h2><MathText text={t.title} /></h2>
      <ol className="slist">
        {t.subtopics.map((x, k) => (
          <li key={x.id}>
            <Link href={`/study/${exam}/${id}/${x.id}`} className="srow go">
              <span className="n">{k + 1}</span>
              <span className="t"><MathText text={x.title} /></span>
              {isDone(progress[x.id]) && <span className="tick" aria-label="Done">&#10003;</span>}
            </Link>
          </li>
        ))}
      </ol>
    </div>
  );
}