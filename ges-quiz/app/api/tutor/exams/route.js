import { NextResponse } from 'next/server';
import { db } from '../../../../lib/supabase';
import { cleanExam } from '../../../../lib/exam';
import { codeProblem } from '../../../../lib/codes';
import { fail, pickScope, refreshExams, requireTutor, saveQuestions } from '../../../../lib/tutor';

// Letters and numbers that cannot be mistaken for each other when read from a board.
const CODE_CHARS = 'abcdefghjkmnpqrstuvwxyz23456789';
const makeCode = () => Array.from({ length: 6 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');

export async function POST(req) {
  const who = await requireTutor(req, { write: true });
  if (who.res) return who.res;
  if (who.status === 'locked') return fail('Your free session has been used. Message us on WhatsApp to activate your account.', 403);
  if (who.status !== 'active' && who.status !== 'trial') return fail('Your account cannot create exams yet.', 403);

  if (!who.ready) return fail('Finish setting up your account first: say what you teach and which school.', 403);

  const body = await req.json().catch(() => null);
  if (!body) return fail('Bad request');
  const parsed = cleanExam(body);
  if (parsed.error) return fail(parsed.error);
  const scope = pickScope(who.member, body);
  if (scope.error) return fail(scope.error);
  const { quiz, questions, code } = parsed.value;

  const supabase = db();
  if (code) {
    const problem = await codeProblem(supabase, code);
    if (problem) return fail(problem, 409);
  }

  // The free session is claimed in one step, so two taps cannot make two free exams.
  let claimed = false;
  if (who.status === 'trial') {
    const { data } = await supabase
      .from('tutor_accounts').update({ free_session_used: true })
      .eq('clerk_id', who.userId).eq('free_session_used', false).select('clerk_id');
    if (!data?.length) return fail('Your free session has been used. Message us on WhatsApp to activate your account.', 403);
    claimed = true;
  }
  const giveBack = () => claimed && supabase.from('tutor_accounts').update({ free_session_used: false }).eq('clerk_id', who.userId);

  let row = null;
  let lastError = null;
  for (let tries = 0; tries < 6 && !row; tries++) {
    const slug = code || makeCode();
    const { data, error } = await supabase
      .from('quizzes')
      .insert({ ...quiz, ...scope.value, slug, tutor_id: who.userId, listed: false, published: true, course: null })
      .select('id, slug').single();
    if (!error) { row = data; break; }
    lastError = error;
    if (error.code !== '23505' || code) break;
  }
  if (!row) {
    await giveBack();
    return fail(lastError?.code === '23505' ? 'That code word is already used. Pick another.' : lastError?.message || 'Could not save', 500);
  }

  const qErr = await saveQuestions(supabase, row.id, questions);
  if (qErr) {
    await supabase.from('quizzes').delete().eq('id', row.id);
    await giveBack();
    return fail(qErr.message, 500);
  }
  refreshExams();
  return NextResponse.json({ id: row.id, slug: row.slug });
}