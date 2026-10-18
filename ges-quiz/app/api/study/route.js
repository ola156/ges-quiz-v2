import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '../../../lib/supabase';
import { sameOrigin } from '../../../lib/guard';
import { getLesson, PASS_MARK } from '../../../lib/study';
import { getMember } from '../../../lib/member';

const bad = (msg, status = 400) => NextResponse.json({ error: msg }, { status });

// Study mode actions for a signed-in student:
//   key    : the answers and explanations, so study mode can show them at once
//   cards  : the student reached the end of the study cards
//   submit : mark the quiz, keep the best score
// The lesson comes from a server cache, and the reads run side by side, so each call is one quick round trip.
export async function POST(req) {
  const { userId } = await auth();
  if (!userId) return bad('Please sign in again.', 401);
  if (!sameOrigin(req)) return bad('Request refused.', 403);

  let body;
  try { body = await req.json(); } catch { return bad('Bad request'); }
  const action = body.action;
  if (!['key', 'cards', 'submit'].includes(action)) return bad('Bad request');
  const supabase = db();

  const [member, lesson, haveRes] = await Promise.all([
    getMember(userId),
    getLesson(body.subtopicId),
    action === 'submit'
      ? supabase.from('study_progress').select('cards_done, best_score, total, attempts').eq('clerk_id', userId).eq('subtopic_id', String(body.subtopicId).slice(0, 80)).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  if (!lesson || (lesson.school && lesson.school !== member?.school)) return bad('Topic not found', 404);
  const questions = lesson.questions;

  if (action === 'key') {
    return NextResponse.json({ key: questions.map((q) => ({ a: q.a, why: q.why || '' })) });
  }

  if (action === 'cards') {
    // Only the columns sent are changed, so an existing score is kept.
    const { error } = await supabase.from('study_progress').upsert(
      { clerk_id: userId, subtopic_id: lesson.id, cards_done: true, updated_at: new Date().toISOString() },
      { onConflict: 'clerk_id,subtopic_id' },
    );
    if (error) return bad('Could not save your progress.', 500);
    return NextResponse.json({ ok: true });
  }

  // submit: answers is { questionNumber: chosenOption or null }, for the questions the student was asked.
  const have = haveRes.data;
  const total = questions.length;
  const given = body.answers && typeof body.answers === 'object' && !Array.isArray(body.answers) ? body.answers : null;
  if (!given) return bad('Bad request');
  const asked = Object.keys(given).map(Number);
  if (!asked.length || asked.length > total || asked.some((i) => !Number.isInteger(i) || i < 0 || i >= total)) return bad('Bad request');
  const review = asked.map((i) => {
    const q = questions[i];
    const c = given[i];
    return { i, correct: q.a, chosen: Number.isInteger(c) && c >= 0 && c < q.o.length ? c : null, why: q.why };
  });
  const score = review.filter((r) => r.chosen === r.correct).length;
  const answered = review.filter((r) => r.chosen !== null).length;
  // A short quiz only counts if enough of the set was answered: half the set, or 10, whichever is smaller.
  const need = Math.min(10, Math.ceil(total / 2));
  const counts = answered >= need;
  const size = review.length;
  const better = counts && (!have?.total || score / size > have.best_score / have.total);
  const { error } = await supabase.from('study_progress').upsert({
    clerk_id: userId, subtopic_id: lesson.id, cards_done: have?.cards_done ?? false,
    best_score: better ? score : have?.best_score ?? null, total: better ? size : have?.total ?? null,
    attempts: (have?.attempts ?? 0) + 1, updated_at: new Date().toISOString(),
  }, { onConflict: 'clerk_id,subtopic_id' });
  if (error) return bad('Could not save your score.', 500);
  return NextResponse.json({ score, total: size, review, counts, need, passed: counts && score / size >= PASS_MARK });
}