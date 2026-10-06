import { NextResponse } from 'next/server';
import { signStart } from '../../../lib/token';

export async function POST(req) {
  const { quizId } = await req.json().catch(() => ({}));
  if (typeof quizId !== 'string' || !/^[0-9a-f-]{36}$/i.test(quizId))
    return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  const startedAt = Date.now();
  return NextResponse.json({ token: signStart(quizId, startedAt), startedAt });
}