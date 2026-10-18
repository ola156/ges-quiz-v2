import { NextResponse } from 'next/server';
import { db } from '../../../../../lib/supabase';
import { cleanExam } from '../../../../../lib/exam';
import { codeProblem } from '../../../../../lib/codes';
import { fail, ownExam, pickScope, refreshExams, requireTutor, saveQuestions } from '../../../../../lib/tutor';

export async function PATCH(req, { params }) {
  const who = await requireTutor(req, { write: true });
  if (who.res) return who.res;
  const { id } = await params;
  const exam = await ownExam(who.userId, id);
  if (!exam) return fail('Exam not found', 404);

  const body = await req.json().catch(() => null);
  if (!body) return fail('Bad request');
  const supabase = db();

  // Quick buttons on the dashboard.
  if (body.action === 'close') {
    const { error } = await supabase.from('quizzes').update({ closes_at: new Date().toISOString() }).eq('id', id);
    if (error) return fail(error.message, 500);
    refreshExams();
    return NextResponse.json({ ok: true });
  }
  if (body.action === 'open') {
    // Open now: remove a future start time and any closing time that has passed or been set by hand.
    const update = { closes_at: null };
    if (exam.opens_at && Date.parse(exam.opens_at) > Date.now()) update.opens_at = null;
    const { error } = await supabase.from('quizzes').update(update).eq('id', id);
    if (error) return fail(error.message, 500);
    refreshExams();
    return NextResponse.json({ ok: true });
  }

  // Full edit from the editor.
  const parsed = cleanExam(body);
  if (parsed.error) return fail(parsed.error);
  const { quiz, questions, code } = parsed.value;
  const scope = pickScope(who.member, body, exam);
  if (scope.error) return fail(scope.error);

  const update = { ...quiz, ...scope.value };
  if (code && code !== exam.slug) {
    const problem = await codeProblem(supabase, code);
    if (problem) return fail(problem, 409);
    update.slug = code;
  }
  const { error } = await supabase.from('quizzes').update(update).eq('id', id);
  if (error) return fail(error.code === '23505' ? 'That code word is already used. Pick another.' : error.message, 500);

  const qErr = await saveQuestions(supabase, id, questions);
  if (qErr) return fail(qErr.message, 500);
  refreshExams();
  return NextResponse.json({ ok: true, slug: update.slug || exam.slug });
}

export async function DELETE(req, { params }) {
  const who = await requireTutor(req, { write: true });
  if (who.res) return who.res;
  const { id } = await params;
  const exam = await ownExam(who.userId, id);
  if (!exam) return fail('Exam not found', 404);
  const { error } = await db().from('quizzes').delete().eq('id', id);
  if (error) return fail(error.message, 500);
  refreshExams();
  return NextResponse.json({ ok: true });
}