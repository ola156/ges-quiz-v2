import Link from 'next/link';
import { notFound } from 'next/navigation';
import Quiz from '../../../components/Quiz';
import { BRAND } from '../../../lib/brand';
import { getQuizBySlug, getSetBoardCached } from '../../../lib/data';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const found = await getQuizBySlug(slug);
  if (!found) return { title: 'Quiz' };
  const meta = { title: `${found.quiz.title} | ${BRAND}` };
  // Private sets must not show up in search engines.
  if (!found.quiz.listed) meta.robots = { index: false, follow: false };
  return meta;
}

export default async function QuizPage({ params }) {
  const { slug } = await params;
  const found = await getQuizBySlug(slug);
  if (!found) notFound();

  const initialBoard = await getSetBoardCached(found.quiz.id);

  return (
    <>
      <Link href="/" className="back">Back to all quizzes</Link>
      <Quiz quiz={found.quiz} questions={found.questions} initialBoard={initialBoard} />
    </>
  );
}
