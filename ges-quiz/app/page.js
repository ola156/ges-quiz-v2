import Link from "next/link";
import { courseKey } from "../lib/leaderboard";
import { BRAND, PARTNER, TAGLINE } from "../lib/brand";
import { getPublishedQuizzes } from "../lib/data";

export const dynamic = "force-dynamic";

export default async function Home() {
  const quizzes = await getPublishedQuizzes();
  const creatorUrl = process.env.NEXT_PUBLIC_CREATOR_GROUP_URL || "";

  const courses = {};
  const other = [];
  for (const q of quizzes) {
    const key = courseKey(q.course);
    if (!key) {
      other.push(q);
      continue;
    }
    const g = (courses[key] ||= { name: q.course.trim(), sets: 0, questions: 0 });
    g.sets += 1;
    g.questions += q.questions?.[0]?.count ?? 0;
  }
  const list = Object.values(courses).sort((a, b) => a.name.localeCompare(b.name));

  return (
    <>
      <header className="hero">
        <span className="pill">Free · No sign-up</span>
        <h1>{BRAND}</h1>
       
        <p>{TAGLINE}</p>
      </header>

      <div className="stack">
        {!quizzes.length ? (
          <p className="muted">No quizzes yet. Check back soon.</p>
        ) : (
          <>
            {list.length > 0 && (
              <section className="stack tight">
                <h2>Choose a course</h2>
                <div className="courses">
                  {list.map((c) => (
                    <Link
                      key={c.name}
                      href={`/course/${encodeURIComponent(c.name)}`}
                      className="course">
                      <span className="course-icon">📚</span>
                      <strong className="course-name">{c.name}</strong>
                      <span className="course-meta">
                        {c.sets} {c.sets === 1 ? "set" : "sets"} · {c.questions} questions
                      </span>
                      <span className="course-go">Open →</span>
                    </Link>
                  ))}
                </div>

                 
              </section>
            )}

            {other.length > 0 && (
              <section className="stack tight">
                <h2>Other sets</h2>
                {other.map((q) => (
                  <Link key={q.slug} href={`/quiz/${q.slug}`} className="card link">
                    <strong>{q.title}</strong>
                    {q.description && <span className="muted">{q.description}</span>}
                    <span className="chips">
                      <span className="chip">{q.questions?.[0]?.count ?? 0} questions</span>
                      {q.time_limit_minutes ? (
                        <span className="chip">{q.time_limit_minutes} min</span>
                      ) : null}
                    </span>
                  </Link>
                ))}

               
              </section>
            )}
          </>
        )}

        {creatorUrl && (
          <div className="card creator">
            <p>Want to turn your own department's lecture slides into interactive AI quizzes for your classmates? Tap here to join our early-access Creator Community.</p>
            <a className="btn ghost" target="_blank" rel="noreferrer" href={creatorUrl}>Join the Creator Community</a>
          </div>
        )}
      </div>
    </>
  );
}