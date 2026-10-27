import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { db } from '../../../../lib/supabase';
import { isAdmin } from '../../../../lib/admin';
import { adminTree } from '../../../../lib/study';
import { parseStudy } from '../../../../lib/studyparse';
import { importLessons } from '../../../../lib/studyimport';
import { isSchool } from '../../../../lib/schools';
import chemistry from '../../../../content/jamb-chemistry';

const EXAMS = ['jamb', 'waec', 'post_utme', 'university'];
const deny = () => NextResponse.json({ error: 'Wrong password' }, { status: 401 });
const bad = (error, status = 400) => NextResponse.json({ error }, { status });
const str = (v, n) => (typeof v === 'string' ? v.trim().slice(0, n) : '');
const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50) || 'subject';
const TABLE = { subject: 'study_subjects', topic: 'study_topics', subtopic: 'study_subtopics' };

async function body(req) {
  try { return await req.json(); } catch { return null; }
}

export async function GET(req) {
  if (!(await isAdmin(req))) return deny();
  try {
    return NextResponse.json({ subjects: await adminTree() });
  } catch (e) {
    return bad(e.message, 500);
  }
}

async function nextPos(table, col, val) {
  const { data } = await db().from(table).select('position').eq(col, val).order('position', { ascending: false }).limit(1);
  return (data?.[0]?.position ?? -1) + 1;
}

// Finds or creates the subject, then the topic, then saves the lesson.
async function save(b) {
  const parsed = parseStudy(b.content);
  if (parsed.errors.length && !parsed.cards.length && !parsed.questions.length) return bad(parsed.errors[0]);
  if (parsed.errors.length) return bad(parsed.errors[0]);
  const title = str(b.title, 120);
  if (!title) return bad('Give the lesson a title');

  let subjectId = str(b.subjectId, 60);
  if (!subjectId) {
    const exam = str(b.exam, 20);
    if (!EXAMS.includes(exam)) return bad('Pick a level');
    const name = str(b.subjectName, 80);
    if (!name) return bad('Name the subject');
    const school = str(b.school, 40) || null;
    if (school && !isSchool(school)) return bad('Unknown school');
    if (school && !['post_utme', 'university'].includes(exam)) return bad('Only Post-UTME and University can be for one school');
    const slug = slugify(name) + (school ? `-${school}` : '');
    const { data: exists } = await db().from('study_subjects').select('id').eq('exam', exam).eq('slug', slug).maybeSingle();
    if (exists) subjectId = exists.id;
    else {
      const { data, error } = await db().from('study_subjects').insert({
        exam, school, slug, name, blurb: str(b.subjectBlurb, 300), published: true,
        position: await nextPos('study_subjects', 'exam', exam),
      }).select('id').single();
      if (error) return bad(error.message, 500);
      subjectId = data.id;
    }
  }

  let topicId = str(b.topicId, 60);
  if (!topicId) {
    const tt = str(b.topicTitle, 120);
    if (!tt) return bad('Name the topic');
    const { data, error } = await db().from('study_topics').insert({
      subject_id: subjectId, title: tt, position: await nextPos('study_topics', 'subject_id', subjectId),
    }).select('id').single();
    if (error) return bad(error.message, 500);
    topicId = data.id;
  } else {
    const { data: t } = await db().from('study_topics').select('id').eq('id', topicId).eq('subject_id', subjectId).maybeSingle();
    if (!t) return bad('Topic not found');
  }

  const row = { title, cards: parsed.cards, questions: parsed.questions };
  const editing = str(b.subtopicId, 80);
  if (editing) {
    const { error } = await db().from('study_subtopics').update({ ...row, topic_id: topicId }).eq('id', editing);
    if (error) return bad(error.message, 500);
    return NextResponse.json({ ok: true, id: editing });
  }
  const { data, error } = await db().from('study_subtopics').insert({
    ...row, topic_id: topicId, published: true, position: await nextPos('study_subtopics', 'topic_id', topicId),
  }).select('id').single();
  if (error) return bad(error.message, 500);
  return NextResponse.json({ ok: true, id: data.id });
}

// Moves the built in JAMB Chemistry content into the database, keeping its old lesson ids.
async function seed() {
  const c = chemistry;
  const { data: found } = await db().from('study_subjects').select('id').eq('exam', c.exam).eq('slug', c.id).maybeSingle();
  if (found) return bad('JAMB Chemistry is already imported');
  const { data: sj, error } = await db().from('study_subjects').insert({
    exam: c.exam, slug: c.id, name: c.name, blurb: c.blurb, published: true, position: 0,
  }).select('id').single();
  if (error) return bad(error.message, 500);
  for (const [ti, t] of c.topics.entries()) {
    const { data: tp, error: e2 } = await db().from('study_topics').insert({ subject_id: sj.id, title: t.title, position: ti }).select('id').single();
    if (e2) return bad(e2.message, 500);
    const rows = t.subtopics.map((s, si) => ({
      id: s.id, topic_id: tp.id, title: s.title, position: si, published: true, cards: s.cards, questions: s.questions,
    }));
    const { error: e3 } = await db().from('study_subtopics').insert(rows);
    if (e3) return bad(e3.message, 500);
  }
  return NextResponse.json({ ok: true });
}

// Adds many lessons from one file. The page sends them a few at a time.
async function bulk(b) {
  if (!Array.isArray(b.lessons) || !b.lessons.length) return bad('No lessons to add');
  if (b.lessons.length > 15) return bad('Send at most 15 lessons at a time');
  const out = await importLessons(b.lessons, { dryRun: b.dryRun === true, published: b.published === true });
  return NextResponse.json({ ok: true, ...out });
}

// Shows lessons (and their subjects) that were imported hidden.
async function showMany(b) {
  const ids = Array.isArray(b.lessonIds) ? b.lessonIds.map((x) => str(x, 80)).filter(Boolean).slice(0, 300) : [];
  const subjects = Array.isArray(b.subjectIds) ? b.subjectIds.map((x) => str(x, 80)).filter(Boolean).slice(0, 50) : [];
  if (!ids.length && !subjects.length) return bad('Nothing to show');
  if (ids.length) {
    const { error } = await db().from('study_subtopics').update({ published: true }).in('id', ids);
    if (error) return bad(error.message, 500);
  }
  if (subjects.length) {
    const { error } = await db().from('study_subjects').update({ published: true }).in('id', subjects);
    if (error) return bad(error.message, 500);
  }
  return NextResponse.json({ ok: true });
}

// Students read study content from a server cache. Any change here refreshes it.
const fresh = (res) => {
  if (res.status < 300) revalidateTag('study');
  return res;
};

export async function POST(req) {
  if (!(await isAdmin(req))) return deny();
  const b = await body(req);
  if (!b) return bad('Bad request');
  if (b.action === 'seed') return fresh(await seed());
  if (b.action === 'save') return fresh(await save(b));
  if (b.action === 'bulk') return fresh(await bulk(b));
  if (b.action === 'show') return fresh(await showMany(b));
  return bad('Bad request');
}

// Hide, show or rename a subject, topic or lesson.
export async function PATCH(req) {
  if (!(await isAdmin(req))) return deny();
  const b = await body(req);
  const table = TABLE[b?.kind];
  const id = str(b?.id, 80);
  if (!table || !id) return bad('Bad request');
  const patch = {};
  if (typeof b.published === 'boolean' && b.kind !== 'topic') patch.published = b.published;
  if (typeof b.title === 'string' && b.kind !== 'subject') patch.title = str(b.title, 120);
  if (typeof b.name === 'string' && b.kind === 'subject') patch.name = str(b.name, 80);
  if (typeof b.blurb === 'string' && b.kind === 'subject') patch.blurb = str(b.blurb, 300);
  if (!Object.keys(patch).length || patch.title === '' || patch.name === '') return bad('Nothing to change');
  const { error } = await db().from(table).update(patch).eq('id', id);
  if (error) return bad(error.message, 500);
  revalidateTag('study');
  return NextResponse.json({ ok: true });
}

export async function DELETE(req) {
  if (!(await isAdmin(req))) return deny();
  const b = await body(req);
  const table = TABLE[b?.kind];
  const id = str(b?.id, 80);
  if (!table || !id) return bad('Bad request');
  const { error } = await db().from(table).delete().eq('id', id);
  if (error) return bad(error.message, 500);
  revalidateTag('study');
  return NextResponse.json({ ok: true });
}