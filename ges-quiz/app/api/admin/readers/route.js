import { NextResponse } from 'next/server';
import { db } from '../../../../lib/supabase';
import { isAdmin } from '../../../../lib/admin';

const DAY = 86400000;
const PAGE = 1000;
const MAX_PAGES = 10; // looks at up to 10,000 recent study records, so the page stays fast as the app grows

// Who is studying and what they are studying, worked out from study progress.
export async function GET(req) {
  if (!(await isAdmin(req))) return NextResponse.json({ error: 'Wrong password' }, { status: 401 });
  const asked = parseInt(new URL(req.url).searchParams.get('days') || '7', 10);
  const days = [1, 7, 30].includes(asked) ? asked : 7;
  const now = Date.now();
  const since = new Date(now - 30 * DAY).toISOString();

  const rows = [];
  let truncated = false;
  for (let p = 0; p < MAX_PAGES; p++) {
    const { data, error } = await db()
      .from('study_progress')
      .select('clerk_id, subtopic_id, cards_done, attempts, updated_at')
      .gte('updated_at', since)
      .order('updated_at', { ascending: false })
      .range(p * PAGE, p * PAGE + PAGE - 1);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    rows.push(...(data || []));
    if ((data || []).length < PAGE) break;
    if (p === MAX_PAGES - 1) truncated = true;
  }

  const { data: tree } = await db()
    .from('study_subjects')
    .select('id, exam, name, study_topics(id, title, study_subtopics(id, title))');
  const lesson = new Map();
  for (const s of tree || []) {
    for (const t of s.study_topics || []) {
      for (const x of t.study_subtopics || []) {
        lesson.set(x.id, { title: x.title, topic: t.title, subject: s.name, subjectId: s.id, exam: s.exam });
      }
    }
  }

  const at = (r) => new Date(r.updated_at).getTime();
  const within = (ms) => rows.filter((r) => now - at(r) <= ms);
  const readers = (list) => new Set(list.map((r) => r.clerk_id)).size;
  const counts = {
    now: readers(within(15 * 60000)),
    day: readers(within(DAY)),
    week: readers(within(7 * DAY)),
    month: readers(rows),
  };

  const list = within(days * DAY).filter((r) => lesson.has(r.subtopic_id));

  const bySubject = new Map();
  const byLesson = new Map();
  for (const r of list) {
    const l = lesson.get(r.subtopic_id);
    if (!bySubject.has(l.subjectId)) bySubject.set(l.subjectId, { name: l.subject, exam: l.exam, who: new Set(), lessons: new Set(), done: 0 });
    const s = bySubject.get(l.subjectId);
    s.who.add(r.clerk_id);
    s.lessons.add(r.subtopic_id);
    if (r.cards_done) s.done++;
    if (!byLesson.has(r.subtopic_id)) byLesson.set(r.subtopic_id, { ...l, who: new Set() });
    byLesson.get(r.subtopic_id).who.add(r.clerk_id);
  }

  // Each person once, with the lesson they touched most recently.
  const latest = new Map();
  for (const r of list) if (!latest.has(r.clerk_id)) latest.set(r.clerk_id, r);
  const recent = [...latest.values()].slice(0, 25);
  const ids = recent.map((r) => r.clerk_id);
  const names = new Map();
  if (ids.length) {
    const { data: m } = await db().from('members').select('clerk_id, display_name, email, track').in('clerk_id', ids);
    for (const x of m || []) names.set(x.clerk_id, x);
  }

  return NextResponse.json({
    days,
    counts,
    truncated,
    subjects: [...bySubject.values()]
      .map((s) => ({ name: s.name, exam: s.exam, readers: s.who.size, lessons: s.lessons.size, completed: s.done }))
      .sort((a, b) => b.readers - a.readers),
    lessons: [...byLesson.values()]
      .map((l) => ({ title: l.title, topic: l.topic, subject: l.subject, readers: l.who.size }))
      .sort((a, b) => b.readers - a.readers)
      .slice(0, 15),
    recent: recent.map((r) => {
      const l = lesson.get(r.subtopic_id);
      const m = names.get(r.clerk_id);
      return {
        name: m?.display_name || m?.email || 'Student',
        track: m?.track || '',
        subject: l.subject,
        title: l.title,
        at: r.updated_at,
      };
    }),
  });
}