import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { db } from '../../../../lib/supabase';
import { isAdmin } from '../../../../lib/admin';

const deny = () => NextResponse.json({ error: 'Wrong password' }, { status: 401 });
const clean = (v, n) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, n) : null);
const toImage = (v) => (typeof v === 'string' && /^https:\/\//.test(v) && v.length < 600 ? v : null);

export async function GET(req) {
  if (!isAdmin(req)) return deny();
  const { data, error } = await db()
    .from('creators')
    .select('id, name, post, agenda, photo_url, logo_url')
    .order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ creators: data || [] });
}

export async function POST(req) {
  if (!isAdmin(req)) return deny();
  const body = await req.json();
  const name = clean(body.name, 80);
  if (!name) return NextResponse.json({ error: 'Creator name is required' }, { status: 400 });
  const { data, error } = await db()
    .from('creators')
    .insert({
      name,
      post: clean(body.post, 80),
      agenda: clean(body.agenda, 600),
      photo_url: toImage(body.photo_url),
      logo_url: toImage(body.logo_url),
    })
    .select('id, name, post, agenda, photo_url, logo_url')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ creator: data });
}

export async function DELETE(req) {
  if (!isAdmin(req)) return deny();
  const { id } = await req.json();
  const { error } = await db().from('creators').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  // Quizzes keep working; their creator card just disappears.
  revalidateTag('quizzes');
  return NextResponse.json({ ok: true });
}
