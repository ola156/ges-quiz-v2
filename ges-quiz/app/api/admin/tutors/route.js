import { NextResponse } from 'next/server';
import { db } from '../../../../lib/supabase';
import { isAdmin } from '../../../../lib/admin';

const deny = () => NextResponse.json({ error: 'Wrong password' }, { status: 401 });

export async function GET(req) {
  if (!isAdmin(req)) return deny();
  const { data, error } = await db()
    .from('tutor_accounts')
    .select('clerk_id, active, free_session_used, created_at, members(display_name, email, centre)')
    .order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({
    tutors: (data || []).map((t) => ({
      id: t.clerk_id,
      active: t.active,
      freeUsed: t.free_session_used,
      createdAt: t.created_at,
      name: t.members?.display_name || '',
      email: t.members?.email || '',
      centre: t.members?.centre || '',
    })),
  });
}

// Switch a tutor on or off. Switching on also records when.
export async function PATCH(req) {
  if (!isAdmin(req)) return deny();
  let body;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Bad request' }, { status: 400 }); }
  const id = typeof body.id === 'string' && /^user_[A-Za-z0-9]{10,60}$/.test(body.id) ? body.id : null;
  if (!id || typeof body.active !== 'boolean')
    return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  const { error } = await db()
    .from('tutor_accounts')
    .update({ active: body.active, activated_at: body.active ? new Date().toISOString() : null })
    .eq('clerk_id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
