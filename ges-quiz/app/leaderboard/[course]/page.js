import Link from 'next/link';
import { db } from '../../../lib/supabase';
import { courseKey } from '../../../lib/leaderboard';
import { getCourseFullCached, getDeptBoardCached } from '../../../lib/data';
import Board from '../../../components/Board';
import DeptBoard from '../../../components/DeptBoard';

export const dynamic = 'force-dynamic';

export default async function CourseLeaderboard({ params }) {
  const { course: raw } = await params;
  let course = raw;
  try { course = decodeURIComponent(raw); } catch {}

  const supabase = db();
  const [rows, depts, { data: all }] = await Promise.all([
    getCourseFullCached(course),
    getDeptBoardCached(course),
    supabase.from('quizzes').select('slug, title, course').eq('published', true).eq('listed', true).not('course', 'is', null),
  ]);
  const sets = (all || []).filter((q) => courseKey(q.course) === courseKey(course));
  const name = sets[0]?.course || course;

  return (
    <div className="stack">
      <Link href="/" className="back">Back to all quizzes</Link>
      <h1>{name} leaderboard</h1>
      <p className="muted">Points are your newest score in each set, added together. Finish more sets to climb.</p>
      <p className="muted small">{rows.length} {rows.length === 1 ? 'student' : 'students'} ranked</p>
      <Board rows={rows} overall />
      <h2>Department ranking</h2>
      <p className="muted small">Average percentage of each department's students. A department needs at least 3 students to appear.</p>
      <DeptBoard rows={depts} />
      <h2>Sets in this course</h2>
      {sets.map((s) => (
        <Link key={s.slug} href={`/quiz/${s.slug}`} className="card link"><strong>{s.title}</strong></Link>
      ))}
    </div>
  );
}