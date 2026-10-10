import { createHash } from 'crypto';

export const courseKey = (c) => String(c || '').trim().toLowerCase();

// user_key is the student's private device id. It must never reach the browser,
// because anyone holding it could act as that student. The boards only get a one-way hash.
const publicKey = (k) => createHash('sha256').update(String(k)).digest('hex').slice(0, 16);

const fromSet = (r) => ({
  key: publicKey(r.user_key), username: r.username, department: r.department, level: r.level,
  points: r.score, possible: r.total, sets: 1, time: r.time_taken,
});
const fromCourse = (r) => ({
  key: publicKey(r.user_key), username: r.username, department: r.department, level: r.level,
  points: r.points, possible: r.possible, sets: r.sets_done, time: r.total_time,
});

// Supabase returns at most 1000 rows per request, so reading everyone means reading in pages.
const PAGE = 1000;
async function fetchAll(build) {
  const out = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await build().range(from, from + PAGE - 1);
    if (error || !data) break;
    out.push(...data);
    if (data.length < PAGE) break;
  }
  return out;
}

// Highest in one set. Ties go to the faster finisher. Pass limit = Infinity for everyone.
export async function getSetBoard(supabase, quizId, limit = 10) {
  const q = () => supabase
    .from('ranked_attempts')
    .select('user_key, username, department, level, score, total, time_taken')
    .eq('quiz_id', quizId)
    .order('score', { ascending: false })
    .order('time_taken', { ascending: true })
    .order('user_key');
  const rows = Number.isFinite(limit) ? (await q().limit(limit)).data : await fetchAll(q);
  return (rows || []).map(fromSet);
}

export async function getSetRank(supabase, quizId, userKey) {
  const { data: me } = await supabase
    .from('ranked_attempts').select('score, time_taken')
    .eq('quiz_id', quizId).eq('user_key', userKey).maybeSingle();
  if (!me) return null;
  const [{ count: ahead }, { count: total }] = await Promise.all([
    supabase.from('ranked_attempts').select('user_key', { count: 'exact', head: true })
      .eq('quiz_id', quizId)
      .or(`score.gt.${me.score},and(score.eq.${me.score},time_taken.lt.${me.time_taken})`),
    supabase.from('ranked_attempts').select('user_key', { count: 'exact', head: true }).eq('quiz_id', quizId),
  ]);
  return { rank: (ahead || 0) + 1, total: total || 0 };
}

// Highest across all sets of a course. Pass limit = Infinity for everyone.
export async function getCourseBoard(supabase, course, limit = 10) {
  const q = () => supabase
    .from('course_board')
    .select('user_key, username, department, level, points, possible, sets_done, total_time')
    .eq('course_key', courseKey(course))
    .order('points', { ascending: false })
    .order('total_time', { ascending: true })
    .order('user_key');
  const rows = Number.isFinite(limit) ? (await q().limit(limit)).data : await fetchAll(q);
  return (rows || []).map(fromCourse);
}

// Highest across all sets of one collection. Pass limit = Infinity for everyone.
export async function getCollectionBoard(supabase, collectionId, limit = 10) {
  const q = () => supabase
    .from('collection_board')
    .select('user_key, username, department, level, points, possible, sets_done, total_time')
    .eq('collection_id', collectionId)
    .order('points', { ascending: false })
    .order('total_time', { ascending: true })
    .order('user_key');
  const rows = Number.isFinite(limit) ? (await q().limit(limit)).data : await fetchAll(q);
  return (rows || []).map(fromCourse);
}

export async function getCourseRank(supabase, course, userKey) {
  const ck = courseKey(course);
  const { data: me } = await supabase
    .from('course_board').select('points, total_time')
    .eq('course_key', ck).eq('user_key', userKey).maybeSingle();
  if (!me) return null;
  const [{ count: ahead }, { count: total }] = await Promise.all([
    supabase.from('course_board').select('user_key', { count: 'exact', head: true })
      .eq('course_key', ck)
      .or(`points.gt.${me.points},and(points.eq.${me.points},total_time.lt.${me.total_time})`),
    supabase.from('course_board').select('user_key', { count: 'exact', head: true }).eq('course_key', ck),
  ]);
  return { rank: (ahead || 0) + 1, total: total || 0 };
}

// Department ranking for a course: average percentage of each department's students.
// A department needs MIN_DEPT students to appear, so one keen person cannot win it alone.
export const MIN_DEPT = 3;
const titleCase = (s) => s.replace(/\b\w/g, (c) => c.toUpperCase());

export async function getDeptBoard(supabase, course, limit = 10) {
  const data = await fetchAll(() => supabase
    .from('course_board').select('department, points, possible')
    .eq('course_key', courseKey(course))
    .order('user_key'));
  const map = new Map();
  for (const r of data || []) {
    const k = String(r.department || '').trim().toLowerCase().replace(/\s+/g, ' ');
    if (!k || !r.possible) continue;
    const d = map.get(k) || { name: titleCase(k), students: 0, pct: 0 };
    d.students += 1;
    d.pct += r.points / r.possible;
    map.set(k, d);
  }
  return [...map.values()]
    .filter((d) => d.students >= MIN_DEPT)
    .map((d) => ({ name: d.name, students: d.students, avg: Math.round((d.pct / d.students) * 1000) / 10 }))
    .sort((a, b) => b.avg - a.avg || b.students - a.students)
    .slice(0, limit);
}