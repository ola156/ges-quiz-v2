import { createHmac, timingSafeEqual, randomUUID } from 'crypto';
import { unstable_cache } from 'next/cache';
import { db } from './supabase';
import { normTrack } from './member';
import { subjectKey } from './jambsubjects';

// Custom practice: random questions, picked from the database, for a subject or course.
// A student's pool is the lesson quizzes in Study plus the public practice quizzes for their exam
// (and school), matched by subject name, so "Chemistry" in both places makes one Chemistry pool.

export const MAX_QUESTIONS = 100;
const CHUNK = 100;
const PAGE = 1000;

function examsFor(track) {
  return track === 'jamb' ? ['jamb', 'waec'] : [track];
}

// The index holds only references to questions (not the questions themselves), grouped by subject.
// It is cached on the server and refreshed when Study content or quizzes change.
async function buildIndex(track, school) {
  const subjects = new Map();
  const slot = (name) => {
    const key = subjectKey(name);
    if (!key) return null;
    if (!subjects.has(key)) subjects.set(key, { key, name: String(name).trim(), refs: [] });
    return subjects.get(key);
  };

  const [{ data: study }, quizRes] = await Promise.all([
    db()
      .from('study_subjects')
      .select('name, school, study_topics(study_subtopics(id, published, questions))')
      .in('exam', examsFor(track))
      .eq('published', true),
    (() => {
      let q = db().from('quizzes').select('id, course, school').eq('published', true).eq('listed', true).not('course', 'is', null);
      q = track === 'university' ? q.or('track.is.null,track.eq.university') : q.in('track', examsFor(track));
      return q;
    })(),
  ]);

  for (const s of study || []) {
    if (s.school && s.school !== school) continue;
    const sl = slot(s.name);
    if (!sl) continue;
    for (const t of s.study_topics || []) {
      for (const x of t.study_subtopics || []) {
        if (!x.published) continue;
        const n = Array.isArray(x.questions) ? x.questions.length : 0;
        for (let i = 0; i < n; i++) sl.refs.push(`s:${x.id}:${i}`);
      }
    }
  }

  const byQuiz = new Map();
  for (const q of quizRes.data || []) {
    if (q.school && q.school !== school) continue;
    const sl = slot(q.course);
    if (sl) byQuiz.set(q.id, sl);
  }
  const ids = [...byQuiz.keys()];
  const chunks = [];
  for (let i = 0; i < ids.length; i += CHUNK) chunks.push(ids.slice(i, i + CHUNK));
  await Promise.all(chunks.map(async (chunk) => {
    for (let from = 0; ; from += PAGE) {
      const { data } = await db().from('questions').select('id, quiz_id').in('quiz_id', chunk).order('id').range(from, from + PAGE - 1);
      for (const r of data || []) byQuiz.get(r.quiz_id)?.refs.push(`q:${r.id}`);
      if (!data || data.length < PAGE) break;
    }
  }));

  return [...subjects.values()].filter((s) => s.refs.length).sort((a, b) => a.name.localeCompare(b.name));
}

const cachedIndex = unstable_cache(buildIndex, ['practice-index'], { tags: ['study', 'quizzes'], revalidate: 300 });

export async function practiceSubjects(track, school) {
  const index = await cachedIndex(normTrack(track), school || '');
  return index.map((s) => ({ key: s.key, name: s.name, count: s.refs.length }));
}

function sample(arr, n) {
  const a = [...arr];
  const take = Math.min(n, a.length);
  for (let i = 0; i < take; i++) {
    const j = i + Math.floor(Math.random() * (a.length - i));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, take);
}

// Turns references back into questions, in the same order. A question deleted since is left out.
export async function loadQuestions(refs) {
  const lessonIds = new Set();
  const quizIds = [];
  for (const r of refs) {
    const [kind, id] = r.split(':');
    if (kind === 's') lessonIds.add(id);
    else if (kind === 'q') quizIds.push(id);
  }
  const [lessons, quizzes] = await Promise.all([
    lessonIds.size ? db().from('study_subtopics').select('id, questions').in('id', [...lessonIds]) : { data: [] },
    quizIds.length ? db().from('questions').select('id, text, options, answer, explanation, image_url').in('id', quizIds) : { data: [] },
  ]);
  const L = new Map((lessons.data || []).map((x) => [x.id, x.questions || []]));
  const Q = new Map((quizzes.data || []).map((x) => [x.id, x]));
  return refs.map((ref) => {
    const [kind, id, idx] = ref.split(':');
    if (kind === 's') {
      const q = L.get(id)?.[Number(idx)];
      return q && Array.isArray(q.o) ? { ref, q: q.q, o: q.o, a: q.a, why: q.why || '', img: null } : null;
    }
    const q = Q.get(id);
    return q && Array.isArray(q.options) ? { ref, q: q.text, o: q.options, a: q.answer, why: q.explanation || '', img: q.image_url || null } : null;
  }).filter(Boolean);
}

// Picks `count` random questions for a subject. Returns null if the student has no such subject.
export async function pickQuestions(track, school, key, count) {
  const index = await cachedIndex(normTrack(track), school || '');
  const subject = index.find((s) => s.key === key);
  if (!subject) return null;
  const refs = sample(subject.refs, Math.max(1, Math.min(MAX_QUESTIONS, count)));
  const questions = await loadQuestions(refs);
  return { subject: { key: subject.key, name: subject.name }, questions };
}

// ---- signed token: says which questions this student was given, so the score is worked out on the server ----
const secret = () => process.env.SUPABASE_SERVICE_ROLE_KEY || 'dev-secret';
const sign = (payload) => createHmac('sha256', secret()).update(payload).digest('base64url');

export function makeToken(data) {
  const body = Buffer.from(JSON.stringify({ ...data, id: randomUUID(), ts: Date.now() })).toString('base64url');
  return `${body}.${sign(body)}`;
}

export function readToken(token, userId) {
  if (typeof token !== 'string') return null;
  const [body, sig] = token.split('.');
  if (!body || !sig) return null;
  const expected = Buffer.from(sign(body));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const d = JSON.parse(Buffer.from(body, 'base64url').toString());
    if (d.u !== userId || Date.now() - d.ts > 12 * 3600 * 1000) return null;
    return d;
  } catch {
    return null;
  }
}