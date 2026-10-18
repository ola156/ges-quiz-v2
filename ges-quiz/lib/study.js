import { unstable_cache } from 'next/cache';
import { db } from './supabase';

export const PASS_MARK = 0.6;

const byPos = (a, b) => (a.position ?? 0) - (b.position ?? 0);

// Turns a database row (with its topics and subtopics inside) into the shape the study pages use.
function shape(row, { all = false } = {}) {
  return {
    dbId: row.id,
    exam: row.exam,
    school: row.school || null,
    id: row.slug, // the part of the address after the exam, like /study/jamb/chemistry
    name: row.name,
    blurb: row.blurb || '',
    published: row.published,
    topics: [...(row.study_topics || [])].sort(byPos).map((t) => ({
      id: t.id,
      title: t.title,
      subtopics: [...(t.study_subtopics || [])]
        .filter((s) => all || s.published)
        .sort(byPos)
        .map((s) => ({ id: s.id, title: s.title, published: s.published })),
    })).filter((t) => all || t.subtopics.length),
  };
}

const TREE = 'id, exam, school, slug, name, blurb, published, position, study_topics(id, title, position, study_subtopics(id, title, position, published))';

// Study content changes only when the admin saves, so it is cached on the server and
// refreshed by the 'study' tag (the admin routes call revalidateTag('study')).
// The tree holds titles only. A lesson holds its cards and questions and is cached on its own.
const loadTree = unstable_cache(
  async () => {
    const { data } = await db().from('study_subjects').select(TREE).order('position').order('name');
    return data || [];
  },
  ['study-tree'],
  { tags: ['study'], revalidate: 3600 },
);

const loadLesson = unstable_cache(
  async (id) => {
    const { data } = await db()
      .from('study_subtopics')
      .select('id, title, cards, questions, published, study_topics(id, title, study_subjects(id, exam, school, slug, name, published))')
      .eq('id', id)
      .maybeSingle();
    return data || null;
  },
  ['study-lesson'],
  { tags: ['study'], revalidate: 3600 },
);

// Subjects a student can see: their exam, for every school or for their own school.
export async function listSubjects(exam, school) {
  if (!exam) return [];
  const tree = await loadTree();
  return tree
    .filter((r) => r.exam === exam && r.published && (!r.school || r.school === school))
    .map((r) => shape(r))
    .filter((x) => x.topics.length);
}

export async function getSubject(exam, slug, school) {
  const tree = await loadTree();
  const row = tree.find((r) => r.exam === exam && r.slug === slug && r.published);
  if (!row || (row.school && row.school !== school)) return null;
  const subject = shape(row);
  return subject.topics.length ? subject : null;
}

// All subtopics of a subject in reading order, each knowing its topic.
export function flatten(subject) {
  return subject.topics.flatMap((t) => t.subtopics.map((s) => ({ ...s, topicId: t.id, topicTitle: t.title })));
}

// One lesson with its answers (server only), plus the previous and next lessons in the subject.
export async function findSubtopic(id, school) {
  if (typeof id !== 'string' || id.length > 80) return null;
  const data = await loadLesson(id);
  const topic = data?.study_topics;
  const sj = topic?.study_subjects;
  if (!data || !data.published || !sj?.published) return null;
  if (sj.school && sj.school !== school) return null;

  const tree = await loadTree();
  const row = tree.find((r) => r.id === sj.id);
  const all = row ? flatten(shape(row)) : [];
  const at = all.findIndex((s) => s.id === data.id);
  return {
    subject: { exam: sj.exam, id: sj.slug, name: sj.name },
    sub: { id: data.id, title: data.title, cards: data.cards || [], questions: data.questions || [], topicId: topic.id, topicTitle: topic.title },
    prev: at > 0 ? all[at - 1] : null,
    next: at >= 0 ? all[at + 1] || null : null,
  };
}

// For the quiz API: just the lesson and the school it is limited to. One cached read.
export async function getLesson(id) {
  if (typeof id !== 'string' || id.length > 80) return null;
  const data = await loadLesson(id);
  const sj = data?.study_topics?.study_subjects;
  if (!data || !data.published || !sj?.published) return null;
  return { id: data.id, school: sj.school || null, questions: data.questions || [] };
}

// The browser gets the questions without the answers. Answers are checked on the server.
export const publicQuestions = (sub) => sub.questions.map((q, i) => ({ i, q: q.q, o: q.o }));

// A subtopic counts as done when the cards were read and the best quiz score is 60% or more.
export const isDone = (p) => Boolean(p?.cards_done && p.total && p.best_score / p.total >= PASS_MARK);

export async function getProgress(clerkId) {
  const { data } = await db()
    .from('study_progress')
    .select('subtopic_id, cards_done, best_score, total, attempts')
    .eq('clerk_id', clerkId);
  return Object.fromEntries((data || []).map((r) => [r.subtopic_id, r]));
}

// For the admin page: everything, including hidden items and the lesson text.
export async function adminTree() {
  const { data } = await db()
    .from('study_subjects')
    .select('id, exam, school, slug, name, blurb, published, position, study_topics(id, title, position, study_subtopics(id, title, position, published, cards, questions))')
    .order('exam').order('position').order('name');
  return (data || []).map((r) => ({
    ...shape({ ...r, study_topics: (r.study_topics || []).map((t) => ({ ...t, study_subtopics: (t.study_subtopics || []).map((s) => ({ ...s })) })) }, { all: true }),
    topics: [...(r.study_topics || [])].sort(byPos).map((t) => ({
      id: t.id,
      title: t.title,
      subtopics: [...(t.study_subtopics || [])].sort(byPos).map((s) => ({
        id: s.id, title: s.title, published: s.published, cards: s.cards || [], questions: s.questions || [],
      })),
    })),
  }));
}