import { NextResponse } from 'next/server';
import { db } from '../../../../lib/supabase';
import { isAdmin } from '../../../../lib/admin';
import { isSchool } from '../../../../lib/schools';
import { NEEDS_SCHOOL, TRACKS } from '../../../../lib/member';

const deny = () => NextResponse.json({ error: 'Wrong password' }, { status: 401 });
const bad = (error, status = 400) => NextResponse.json({ error }, { status });
const PAGE = 30;
const ID = /^user_[A-Za-z0-9]{10,60}$/;

// One page of students at a time, searched and filtered in the database, so it stays fast with thousands of accounts.
export async function GET(req) {
  if (!(await isAdmin(req))) return deny();
  const u = new URL(req.url);
  const page = Math.max(0, parseInt(u.searchParams.get('page') || '0', 10) || 0);
  const track = u.searchParams.get('track') || '';
  // Characters that mean something in a search filter are removed.
  const q = (u.searchParams.get('q') || '').trim().slice(0, 60).replace(/[%,()*\\]/g, ' ');

  let query = db()
    .from('members')
    .select('clerk_id, display_name, email, track, school, department, class_level, created_at', { count: 'exact' })
    .eq('role', 'student')
    .order('created_at', { ascending: false })
    .range(page * PAGE, page * PAGE + PAGE - 1);
  if (TRACKS[track]) query = query.eq('track', track);
  if (q) query = query.or(`display_name.ilike.%${q}%,email.ilike.%${q}%`);

  const { data, count, error } = await query;
  if (error) return bad(error.message, 500);
  return NextResponse.json({
    students: (data || []).map((s) => ({
      id: s.clerk_id, name: s.display_name || '', email: s.email || '', track: s.track, school: s.school || '',
      department: s.department || '', level: s.class_level || '', joined: s.created_at,
    })),
    total: count ?? 0,
    page,
    pageSize: PAGE,
  });
}

// Fix a student's exam or school.
export async function PATCH(req) {
  if (!(await isAdmin(req))) return deny();
  let b;
  try { b = await req.json(); } catch { return bad('Bad request'); }
  if (typeof b.id !== 'string' || !ID.test(b.id) || !TRACKS[b.track]) return bad('Bad request');
  const needs = NEEDS_SCHOOL.has(b.track);
  if (needs && !isSchool(b.school)) return bad('Pick a school for this exam');
  const { error } = await db()
    .from('members')
    .update({ track: b.track, school: needs ? b.school : null, updated_at: new Date().toISOString() })
    .eq('clerk_id', b.id).eq('role', 'student');
  if (error) return bad(error.message, 500);
  return NextResponse.json({ ok: true });
}

// Reset: removes the profile record only. The sign-in account stays, and the student picks their exam again next time.
export async function DELETE(req) {
  if (!(await isAdmin(req))) return deny();
  let b;
  try { b = await req.json(); } catch { return bad('Bad request'); }
  if (typeof b.id !== 'string' || !ID.test(b.id)) return bad('Bad request');
  const { error } = await db().from('members').delete().eq('clerk_id', b.id).eq('role', 'student');
  if (error) return bad(error.message, 500);
  return NextResponse.json({ ok: true });
}