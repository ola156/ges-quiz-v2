import Link from "next/link";
import { notFound } from "next/navigation";
import { courseKey } from "../../../lib/leaderboard";
import { getPublishedQuizzes, getCourseTopCached } from "../../../lib/data";
import Board from "../../../components/Board";

export const dynamic = "force-dynamic";

export default async function CoursePage({ params }) {
  const { course: raw } = await params;
  let course = raw;
  try {
    course = decodeURIComponent(raw);
  } catch {}

  const [all, top] = await Promise.all([getPublishedQuizzes(), getCourseTopCached(course)]);

  const sets = all.filter((q) => courseKey(q.course) === courseKey(course));
  if (!sets.length) notFound();
  const name = sets[0].course.trim();
  const totalQuestions = sets.reduce((n, q) => n + (q.questions?.[0]?.count ?? 0), 0);

  return (
    <div className="stack">
      <Link href="/" className="back">All courses</Link>

      <header className="hero">
        <span className="pill">{sets.length} {sets.length === 1 ? "set" : "sets"} · {totalQuestions} questions</span>
        <h1>{name}</h1>
        <p>Pick a set to practise. Your newest score on each set is the one that counts on the leaderboard.</p>
      </header>

      <Link href={`/leaderboard/${encodeURIComponent(name)}`} className="lb-banner">
        <span className="lb-trophy">🏆</span>
        <span className="lb-text">
          <strong>{name} leaderboard</strong>
          <span>See who is on top and where your department stands</span>
        </span>
        <span className="lb-go">→</span>
      </Link>

      <section className="stack tight">
        <h2>Sets</h2>
        {sets.map((q, n) => (
          <Link key={q.slug} href={`/quiz/${q.slug}`} className="card link">
            <span className="set-no">Set {sets.length - n}</span>
            <strong>{q.title}</strong>
            {q.description && <span className="muted">{q.description}</span>}
            <span className="chips">
              <span className="chip">{q.questions?.[0]?.count ?? 0} questions</span>
              {q.time_limit_minutes ? <span className="chip">{q.time_limit_minutes} min</span> : null}
            </span>
          </Link>
        ))}
      </section>

      {top.length > 0 && (
        <section className="stack tight">
          <h2>Top 3 right now</h2>
          <Board rows={top} overall />
          <Link href={`/leaderboard/${encodeURIComponent(name)}`}>See the full leaderboard</Link>
        </section>
      )}
    </div>
  );
}