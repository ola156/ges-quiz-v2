import { NextResponse } from 'next/server';
import { db } from '../../../../lib/supabase';

// Turns a typed code into a page: a collection, then a creator's page, then a single private set.
export async function GET(_req, { params }) {
  const { code } = await params;
  const c = String(code || '').toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 40);
  if (!c) return NextResponse.json({ ok: false });

  const supabase = db();
  const { data: col } = await supabase
    .from('collections').select('code').eq('code', c).eq('published', true).maybeSingle();
  if (col) return NextResponse.json({ ok: true, path: `/c/${col.code}` });

  const { data: creator } = await supabase.from('creators').select('code').eq('code', c).maybeSingle();
  if (creator) return NextResponse.json({ ok: true, path: `/u/${creator.code}` });

  const { data: quiz } = await supabase
    .from('quizzes').select('slug').eq('slug', c).eq('published', true).eq('listed', false).maybeSingle();
  if (quiz) return NextResponse.json({ ok: true, path: `/quiz/${quiz.slug}` });

  return NextResponse.json({ ok: false });
}