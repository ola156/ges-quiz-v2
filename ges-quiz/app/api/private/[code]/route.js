import { NextResponse } from 'next/server';
import { db } from '../../../../lib/supabase';

// Tells the code box whether a private set exists. It returns nothing else about the set.
export async function GET(_req, { params }) {
  const { code } = await params;
  const c = String(code || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!c) return NextResponse.json({ ok: false });
  const { data } = await db()
    .from('quizzes').select('id').eq('slug', c).eq('published', true).eq('listed', false).maybeSingle();
  return NextResponse.json({ ok: Boolean(data) });
}
