import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { auth } from '@clerk/nextjs/server';
import { db } from './supabase';
import { sameOrigin } from './guard';
import { getMember, getTutorAccount, tutorStatus, tutorReady, NEEDS_SCHOOL } from './member';

export const fail = (msg, status = 400) => NextResponse.json({ error: msg }, { status });

// Exam pages are cached for a minute, so clear them whenever a tutor changes something.
export const refreshExams = () => {
  revalidateTag('quizzes');
  revalidateTag('boards');
};

// Every tutor route starts here. The person is always read from the signed-in session,
// never from the request body.
export async function requireTutor(req, { write = false } = {}) {
  if (write && !sameOrigin(req)) return { res: fail('Bad request', 403) };
  const { userId } = await auth();
  if (!userId) return { res: fail('Please sign in again.', 401) };
  const member = await getMember(userId);
  if (!member || member.role !== 'tutor') return { res: fail('This is for tutor accounts.', 403) };
  const account = await getTutorAccount(userId);
  return { userId, member, account, status: tutorStatus(account), ready: tutorReady(member) };
}

// Every exam is filed under one exam type and, for University and Post-UTME, one school.
// Both must be ones the tutor chose when they set up their account. When editing, the exam's
// current values are always allowed, so an old exam never becomes impossible to save.
export function pickScope(member, body, current = {}) {
  const track = typeof body.track === 'string' ? body.track : '';
  if (!track || !((member.tracks || []).includes(track) || track === current.track))
    return { error: 'Pick which exam this is for, from the ones you teach.' };
  if (!NEEDS_SCHOOL.has(track)) return { value: { track, school: null } };
  const school = typeof body.school === 'string' ? body.school : '';
  if (!school || !((member.schools || []).includes(school) || school === current.school))
    return { error: 'Pick the school this exam belongs to, from your schools.' };
  return { value: { track, school } };
}

// An exam, only if it belongs to this tutor.
export async function ownExam(userId, id, cols = 'id, slug, title, opens_at, closes_at, track, school') {
  if (typeof id !== 'string' || !/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data } = await db().from('quizzes').select(cols).eq('id', id).eq('tutor_id', userId).maybeSingle();
  return data || null;
}

// Saves the question list of an exam. Questions that already exist keep their id,
// so a student who is in the middle of the exam is not affected by a small fix.
export async function saveQuestions(supabase, quizId, questions) {
  const { data: have } = await supabase.from('questions').select('id').eq('quiz_id', quizId);
  const haveIds = new Set((have || []).map((r) => r.id));

  const rows = questions.map((q, i) => ({
    ...(q.id && haveIds.has(q.id) ? { id: q.id } : {}),
    quiz_id: quizId,
    position: i + 1,
    subject: q.subject,
    text: q.text,
    options: q.options,
    answer: q.answer,
    explanation: q.explanation,
  }));

  const keep = new Set(rows.filter((r) => r.id).map((r) => r.id));
  const drop = [...haveIds].filter((id) => !keep.has(id));
  if (drop.length) {
    const { error } = await supabase.from('questions').delete().in('id', drop);
    if (error) return error;
  }
  const old = rows.filter((r) => r.id);
  const fresh = rows.filter((r) => !r.id);
  if (old.length) {
    const { error } = await supabase.from('questions').upsert(old, { onConflict: 'id' });
    if (error) return error;
  }
  if (fresh.length) {
    const { error } = await supabase.from('questions').insert(fresh);
    if (error) return error;
  }
  return null;
}