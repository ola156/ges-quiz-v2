import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { db } from '../../../lib/supabase';
import { getSetBoard, getSetRank, getCourseBoard, getCourseRank } from '../../../lib/leaderboard';
import { readStart } from '../../../lib/token';
import { examState } from '../../../lib/exam';

const clean = (v, n) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, n) : null);
const sanitize = (u) => String(u || '').toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 20);
const digits = (n) => String(Math.floor(Math.random() * 10 ** n)).padStart(n, '0');
const bad = (msg, status = 400) => NextResponse.json({ error: msg }, { status });
const PROFILE_COLS = 'username, name, department, level';
// Browsers make a v4 UUID. Anything else is rejected.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(req) {
  const body = await req.json();
  const { quizId, answers, profile = {} } = body;
  if (!quizId || !answers || typeof answers !== 'object') return bad('Bad request');
  const clientId = typeof body.clientId === 'string' ? body.clientId.trim().toLowerCase() : '';
  if (!UUID_RE.test(clientId)) return bad('Invalid session. Reload the page and try again.');

  const supabase = db();
  const { data: quiz } = await supabase
    .from('quizzes')
    .select('id, course, time_limit_minutes, tutor_id, opens_at, closes_at, show_score, ask_department, ask_level')
    .eq('id', quizId).maybeSingle();
  if (!quiz) return bad('Quiz not found', 404);

  const { data: questions } = await supabase
    .from('questions').select('id, answer, explanation, subject').eq('quiz_id', quizId).order('position');
  if (!questions?.length) return bad('Quiz not found', 404);

  // A tutor can close an exam. Someone who started while it was open may still finish and hand in.
  const startedAt = readStart(body.token, quizId);
  const state = examState(quiz);
  if (state === 'scheduled') return bad('This exam has not opened yet.', 403);
  if (state === 'closed' && !(startedAt && startedAt < Date.parse(quiz.closes_at)))
    return bad('This exam is closed.', 403);

  const review = questions.map((q) => ({
    id: q.id,
    correct: q.answer,
    chosen: Number.isInteger(answers[q.id]) ? answers[q.id] : null,
    explanation: q.explanation,
  }));
  const score = review.filter((r) => r.chosen === r.correct).length;

  // Marks per subject, for exams that have subjects.
  let subjectScores = null;
  if (questions.some((q) => q.subject)) {
    subjectScores = {};
    questions.forEach((q, n) => {
      const key = q.subject || 'Other';
      subjectScores[key] = subjectScores[key] || [0, 0];
      subjectScores[key][1] += 1;
      if (review[n].chosen === review[n].correct) subjectScores[key][0] += 1;
    });
  }

  // Tutor exams run on shared laptops. There is no saved profile and no username: a name is
  // all that is needed, and every attempt is its own person on the tutor's results page.
  if (quiz.tutor_id) {
    const name = clean(profile.name, 80);
    const department = clean(profile.department, 80);
    const level = clean(profile.level, 10);
    if (!name) return bad('Type your name to continue.');
    if (quiz.ask_department && !department) return bad('Enter your department.');
    if (quiz.ask_level && !level) return bad('Enter your level.');

    const limit = quiz.time_limit_minutes ? quiz.time_limit_minutes * 60 : 0;
    let taken = null;
    let isLate = true;
    if (startedAt) {
      const elapsed = Math.max(0, Math.round((Date.now() - startedAt) / 1000));
      isLate = Boolean(limit) && elapsed > limit + 60;
      taken = limit ? Math.min(elapsed, limit) : elapsed;
    }

    // Handing in twice from the same attempt (a retry after a bad connection) saves only once.
    const { count: already } = await supabase.from('submissions')
      .select('id', { count: 'exact', head: true }).eq('quiz_id', quizId).eq('client_id', clientId);
    if (!already) {
      const username = (sanitize(name.split(/\s+/)[0]) || 'student').slice(0, 12) + digits(3);
      const { error: insErr } = await supabase.from('submissions').insert({
        quiz_id: quizId, name, username, client_id: clientId,
        department: quiz.ask_department ? department : null,
        level: quiz.ask_level ? level : null,
        score, total: questions.length, time_taken: taken, late: isLate, subject_scores: subjectScores,
      });
      if (insErr) return bad(insErr.message, 500);
      revalidateTag('boards');
    }

    if (!quiz.show_score) return NextResponse.json({ hidden: true, name });
    const [setBoard, setRank] = await Promise.all([
      getSetBoard(supabase, quizId, 10),
      getSetRank(supabase, quizId, clientId),
    ]);
    return NextResponse.json({
      score, total: questions.length, review, name, subjectScores,
      setBoard, setRank, counted: !isLate, late: isLate, lateReason: startedAt ? (isLate ? 'time' : null) : 'no-start',
    });
  }

  // Who is this? Each device gets one profile the first time. After that it is locked,
  // so whatever is sent in `profile` is ignored and the saved details are used.
  let me = (await supabase.from('profiles').select(PROFILE_COLS).eq('client_id', clientId).maybeSingle()).data;

  if (!me) {
    const name = clean(profile.name, 80);
    const department = clean(profile.department, 80);
    const level = clean(profile.level, 10);
    if (!name || !department || !level) return bad('Name, department and level are required');

    const typedRaw = typeof profile.username === 'string' ? profile.username.trim() : '';
    const typed = sanitize(typedRaw);
    if (typedRaw && typed.length < 3) return bad('Username needs at least 3 letters or numbers');

    const base = (sanitize(name.split(/\s+/)[0]) || 'student').slice(0, 12);
    let username = typed;
    for (let tries = 0; tries < 8 && !me; tries++) {
      if (!username) username = base + digits(tries < 4 ? 3 : 5);
      const { data, error } = await supabase
        .from('profiles')
        .insert({ client_id: clientId, username, name, department, level, whatsapp: clean(profile.whatsapp, 20) })
        .select(PROFILE_COLS)
        .single();
      if (!error) { me = data; break; }
      if (error.code !== '23505') return bad(error.message, 500);

      // Unique violation: either this device just registered (double tap) or the username is taken.
      const again = (await supabase.from('profiles').select(PROFILE_COLS).eq('client_id', clientId).maybeSingle()).data;
      if (again) { me = again; break; }
      if (typed) return bad('That username is already taken. Pick another one.', 409);
      username = '';
    }
    if (!me) return bad('Could not make a username. Type one yourself and try again.', 500);
  }

  // Time is measured by the server from the signed start token, not by the browser.
  // No valid token, or finishing well after the limit, means the attempt is not ranked.
  const limitSec = quiz.time_limit_minutes ? quiz.time_limit_minutes * 60 : 0;
  let time = null;
  let late = true;
  let lateReason = 'no-start';
  if (startedAt) {
    const elapsed = Math.max(0, Math.round((Date.now() - startedAt) / 1000));
    late = Boolean(limitSec) && elapsed > limitSec + 60;
    lateReason = late ? 'time' : null;
    time = limitSec ? Math.min(elapsed, limitSec) : elapsed;
  }

  // Where they stood before this attempt, so a retake can show how the rank moved.
  const [prevSetRank, prevCourseRank, { count: before }] = await Promise.all([
    getSetRank(supabase, quizId, clientId),
    quiz.course ? getCourseRank(supabase, quiz.course, clientId) : null,
    supabase.from('submissions').select('id', { count: 'exact', head: true })
      .eq('quiz_id', quizId).eq('client_id', clientId),
  ]);
  const isFirst = !before;

  const { error: insErr } = await supabase.from('submissions').insert({
    quiz_id: quizId, name: me.name, username: me.username, client_id: clientId,
    department: me.department, level: me.level, whatsapp: clean(profile.whatsapp, 20),
    score, total: questions.length, time_taken: time, late,
    ...(subjectScores ? { subject_scores: subjectScores } : {}),
  });
  if (insErr) return bad(insErr.message, 500);

  // Leaderboards are cached for speed, so clear them after every submission.
  revalidateTag('boards');

  const [setBoard, setRank, courseBoard, courseRank] = await Promise.all([
    getSetBoard(supabase, quizId, 10),
    getSetRank(supabase, quizId, clientId),
    quiz.course ? getCourseBoard(supabase, quiz.course, 10) : [],
    quiz.course ? getCourseRank(supabase, quiz.course, clientId) : null,
  ]);

  return NextResponse.json({
    score, total: questions.length, review,
    username: me.username,
    profile: { name: me.name, username: me.username, department: me.department, level: me.level },
    setBoard, setRank, prevSetRank, courseBoard, courseRank, prevCourseRank,
    counted: !late, isFirst, late, lateReason,
  });
}