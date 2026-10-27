import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '../../../lib/supabase';
import { sameOrigin } from '../../../lib/guard';
import { getMember } from '../../../lib/member';
import { loadQuestions, makeToken, pickQuestions, readToken, MAX_QUESTIONS } from '../../../lib/practice';

const bad = (msg, status = 400) => NextResponse.json({ error: msg }, { status });

// Custom practice for a signed-in student.
//   start  : pick random questions for a subject and hand back a signed token
//   submit : mark the answers on the server and save the score for the leaderboard
export async function POST(req) {
  const { userId } = await auth();
  if (!userId) return bad('Please sign in again.', 401);
  if (!sameOrigin(req)) return bad('Request refused.', 403);
  let body;
  try { body = await req.json(); } catch { return bad('Bad request'); }

  if (body.action === 'start') {
    const member = await getMember(userId);
    if (!member) return bad('Finish setting up your account first.', 403);
    const count = Math.round(Number(body.count));
    const mode = body.mode === 'exam' ? 'exam' : 'study';
    if (!Number.isFinite(count) || count < 1 || count > MAX_QUESTIONS) return bad(`Choose between 1 and ${MAX_QUESTIONS} questions.`);
    const key = String(body.subject || '').slice(0, 120);

    const picked = await pickQuestions(member.track, member.school, key, count);
    if (!picked || !picked.questions.length) return bad('That subject has no questions yet.', 404);
    const qs = picked.questions;

    const token = makeToken({
      u: userId, t: member.track, k: picked.subject.key, n: picked.subject.name, m: mode,
      r: qs.map((q) => q.ref), a: qs.map((q) => q.a),
    });
    return NextResponse.json({
      token,
      subject: picked.subject.name,
      questions: qs.map((q, i) => ({ i, q: q.q, o: q.o, img: q.img })),
      // Study mode shows each answer at once, so it gets the key now. Exam mode only gets it after hand-in.
      key: mode === 'study' ? qs.map((q) => ({ a: q.a, why: q.why })) : undefined,
    });
  }

  if (body.action === 'submit') {
    const tok = readToken(body.token, userId);
    if (!tok) return bad('This practice has expired. Start a new one.', 400);
    const given = body.answers && typeof body.answers === 'object' && !Array.isArray(body.answers) ? body.answers : {};
    const total = tok.a.length;
    const picks = tok.a.map((_, i) => {
      const c = given[i];
      return Number.isInteger(c) && c >= 0 && c < 8 ? c : null;
    });
    const score = picks.filter((c, i) => c === tok.a[i]).length;
    const answered = picks.filter((c) => c !== null).length;

    // Explanations are only needed for what the student got wrong or skipped.
    const wrongIdx = picks.map((c, i) => (c === tok.a[i] ? -1 : i)).filter((i) => i >= 0);
    const loaded = wrongIdx.length ? await loadQuestions(wrongIdx.map((i) => tok.r[i])) : [];
    const whyByRef = new Map(loaded.map((q) => [q.ref, q.why]));
    const review = tok.a.map((correct, i) => ({
      i, correct, chosen: picks[i], why: picks[i] === correct ? '' : whyByRef.get(tok.r[i]) || '',
    }));

    let saved = false;
    if (answered > 0) {
      // The token id is the row id, so handing the same practice in twice saves it once.
      const { error } = await db().from('practice_attempts').insert({
        id: tok.id, clerk_id: userId, track: tok.t, subject: tok.k, subject_name: tok.n, mode: tok.m, total, correct: score,
      });
      saved = !error;
    }
    const member = await getMember(userId);
    return NextResponse.json({ score, total, answered, review, saved, subject: tok.n, name: member?.display_name || '' });
  }

  return bad('Bad request');
}