import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { auth } from '@clerk/nextjs/server';
import StudyRunner from '../../../../../components/StudyRunner';
import MathText from '../../../../../components/MathText';
import { findSubtopic, getProgress, publicQuestions } from '../../../../../lib/study';
import { getMember } from '../../../../../lib/member';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Study | Instrict Quizmate', robots: { index: false, follow: false } };

export default async function SubtopicPage({ params }) {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');
  const { exam, subject: subjectId, subtopic } = await params;
  const member = await getMember(userId);
  const found = await findSubtopic(subtopic, member?.school);
  if (!found || found.subject.exam !== exam || found.subject.id !== subjectId) notFound();

  const { sub, next } = found;
  const progress = (await getProgress(userId))[sub.id];
  const base = `/study/${exam}/${subjectId}`;
  const topicHref = `${base}/topic/${sub.topicId}`;

  return (
    <div className="stack">
        <Link href={topicHref} className="back">Back to <MathText text={sub.topicTitle} /></Link>
        <h2><MathText text={sub.title} /></h2>
        <StudyRunner
          subtopicId={sub.id}
          cards={sub.cards}
          questions={publicQuestions(sub)}
          initial={{ cardsDone: Boolean(progress?.cards_done), best: progress?.best_score ?? null, total: progress?.total ?? null }}
          backHref={topicHref}
          next={next ? { href: `${base}/${next.id}`, title: next.title } : null}
        />
    </div>
  );
}