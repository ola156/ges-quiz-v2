import { NextResponse } from 'next/server';
import { db } from '../../../lib/supabase';
import { examState } from '../../../lib/exam';
import { signStart } from '../../../lib/token';

export async function POST(req) {
  const { quizId } = await req.json().catch(() => ({}));
  if (typeof quizId !== 'string' || !/^[0-9a-f-]{36}$/i.test(quizId))
    return NextResponse.json({ error: 'Bad request' }, { status: 400 });

  // A tutor can close an exam or set a start time. Nobody can begin outside that window.
  const { data: quiz } = await db().from('quizzes').select('opens_at, closes_at').eq('id', quizId).maybeSingle();
  if (!quiz) return NextResponse.json({ error: 'Quiz not found' }, { status: 404 });
  const state = examState(quiz);
  if (state !== 'open')
    return NextResponse.json({ error: state === 'closed' ? 'This exam is closed.' : 'This exam has not opened yet.', state }, { status: 403 });

  const startedAt = Date.now();
  return NextResponse.json({ token: signStart(quizId, startedAt), startedAt });
}