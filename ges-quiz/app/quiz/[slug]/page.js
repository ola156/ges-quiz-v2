import Link from 'next/link';
import { notFound } from 'next/navigation';
import Quiz from '../../../components/Quiz';
import { BRAND } from '../../../lib/brand';
import { getQuizBySlug, getSetBoardCached } from '../../../lib/data';
import { examState, lagos } from '../../../lib/exam';

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

  const { quiz } = found;
  const state = examState(quiz);

  if (state !== 'open') {
    return (
      <section className="stack">
        <h1>{quiz.title}</h1>
        {quiz.host && <p className="muted">{quiz.host}</p>}
        <div className="card stack tight">
          {state === 'scheduled' ? (
            <>
              <strong>This exam has not opened yet</strong>
              <p className="muted small">It opens on {lagos(quiz.opens_at)} (Nigerian time).</p>
            </>
          ) : (
            <>
              <strong>This exam is closed</strong>
              <p className="muted small">It closed on {lagos(quiz.closes_at)} (Nigerian time). Ask your tutor if you think this is a mistake.</p>
            </>
          )}
          <a className="btn ghost" href={`/quiz/${slug}`}>Check again</a>
        </div>
      </section>
    );
  }

  // Tutor exams hide the board unless the tutor lets students see results.
  const initialBoard = quiz.station && !quiz.show_score ? [] : await getSetBoardCached(quiz.id);
  const col = quiz.collections;

  return (
    <>
      {!quiz.station && (
        <Link href={col ? `/c/${col.code}` : '/browse'} className="back">
          {col ? `Back to ${col.title}` : 'Back to all quizzes'}
        </Link>
      )}
      <Quiz quiz={quiz} questions={found.questions} initialBoard={initialBoard} />
    </>
  );
}