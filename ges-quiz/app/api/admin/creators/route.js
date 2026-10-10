import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { db } from '../../../../lib/supabase';
import { isAdmin } from '../../../../lib/admin';
import { normCode, codeProblem } from '../../../../lib/codes';

const deny = () => NextResponse.json({ error: 'Wrong password' }, { status: 401 });
const fail = (msg, status = 400) => NextResponse.json({ error: msg }, { status });
const clean = (v, n) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, n) : null);
const toImage = (v) => (typeof v === 'string' && /^https:\/\//.test(v) && v.length < 600 ? v : null);
const COLS = 'id, name, post, agenda, photo_url, logo_url, code';

export async function GET(req) {
  if (!isAdmin(req)) return deny();
  const { data, error } = await db()
    .from('creators')
    .select(COLS)
    .order('created_at', { ascending: false });
  if (error) return fail(error.message, 500);
  return NextResponse.json({ creators: data || [] });
}

export async function POST(req) {
  if (!isAdmin(req)) return deny();
  const body = await req.json();
  const name = clean(body.name, 80);
  if (!name) return fail('Creator name is required');
  const supabase = db();

  // The code word is optional here. It can be added later from the Creators tab.
  const code = normCode(body.code);
  if (code) {
    const problem = await codeProblem(supabase, code);
    if (problem) return fail(problem);
  }

  const { data, error } = await supabase
    .from('creators')
    .insert({
      name,
      post: clean(body.post, 80),
      agenda: clean(body.agenda, 600),
      photo_url: toImage(body.photo_url),
      logo_url: toImage(body.logo_url),
      code: code || null,
    })
    .select(COLS)
    .single();
  if (error) return fail(error.code === '23505' ? 'That code word is already used.' : error.message, 500);
  revalidateTag('quizzes');
  return NextResponse.json({ creator: data });
}

// Sets or removes a creator's code word.
export async function PATCH(req) {
  if (!isAdmin(req)) return deny();
  const body = await req.json();
  if (!body.id) return fail('Missing creator');
  const supabase = db();
  const code = normCode(body.code);
  if (code) {
    const problem = await codeProblem(supabase, code, { creatorId: body.id });
    if (problem) return fail(problem);
  }
  const { error } = await supabase.from('creators').update({ code: code || null }).eq('id', body.id);
  if (error) return fail(error.code === '23505' ? 'That code word is already used.' : error.message, 500);
  revalidateTag('quizzes');
  return NextResponse.json({ ok: true, code: code || null });
}

export async function DELETE(req) {
  if (!isAdmin(req)) return deny();
  const { id } = await req.json();
  const { error } = await db().from('creators').delete().eq('id', id);
  if (error) return fail(error.message, 500);
  // Quizzes keep working; their creator card just disappears.
  revalidateTag('quizzes');
  return NextResponse.json({ ok: true });
}