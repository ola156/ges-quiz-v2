import { NextResponse } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';
import { db } from '../../../../lib/supabase';
import { sameOrigin, cleanText } from '../../../../lib/guard';
import { TRACKS, NEEDS_SCHOOL, CLASS_LEVELS } from '../../../../lib/member';
import { isSchool } from '../../../../lib/schools';

const bad = (msg, status = 400) => NextResponse.json({ error: msg }, { status });

// Saves who the signed-in person is. The person comes from the Clerk session, never from
// the request body, and only the fields listed here are ever written.
export async function POST(req) {
  const { userId } = await auth();
  if (!userId) return bad('Sign in to continue.', 401);
  if (!sameOrigin(req)) return bad('Request refused.', 403);

  let body;
  try { body = await req.json(); } catch { return bad('Bad request'); }

  const role = body.role === 'tutor' ? 'tutor' : body.role === 'student' ? 'student' : null;
  if (!role) return bad('Choose student or tutor.');

  const row = { clerk_id: userId, role, updated_at: new Date().toISOString() };

  if (role === 'student') {
    const track = typeof body.track === 'string' && Object.hasOwn(TRACKS, body.track) ? body.track : null;
    if (!track) return bad('Choose your exam.');
    const school = cleanText(body.school, 80);
    if (NEEDS_SCHOOL.has(track) && !school) return bad('Tell us your school.');
    // New picks must come from the school list. A school typed in earlier can stay as it is.
    if (NEEDS_SCHOOL.has(track) && !isSchool(school)) {
      const { data: cur } = await db().from('members').select('school').eq('clerk_id', userId).maybeSingle();
      if (cur?.school !== school) return bad('Pick your school from the list.');
    }
    row.track = track;
    row.display_name = cleanText(body.displayName, 80); // what they typed; filled from Clerk below if empty
    row.school = NEEDS_SCHOOL.has(track) ? school : null;
    row.department = track === 'university' ? cleanText(body.department, 80) : null;
    row.class_level = track === 'university' && CLASS_LEVELS.includes(String(body.classLevel)) ? String(body.classLevel) : null;
  } else {
    const name = cleanText(body.displayName, 80);
    if (!name) return bad('Enter the name students will see.');
    row.display_name = name;
    row.centre = cleanText(body.centre, 80);

    // What the tutor teaches, and the school(s) their University and Post-UTME exams belong to.
    let tracks = Array.isArray(body.tracks) ? [...new Set(body.tracks.filter((t) => typeof t === 'string' && Object.hasOwn(TRACKS, t)))] : [];
    let schools = Array.isArray(body.schools) ? [...new Set(body.schools.filter(isSchool))].slice(0, 10) : [];

    // Once a tutor has an exam, nothing can be taken away here, only added. That keeps exams inside their school.
    const supabase0 = db();
    const [{ count: made }, { data: cur }] = await Promise.all([
      supabase0.from('quizzes').select('id', { count: 'exact', head: true }).eq('tutor_id', userId),
      supabase0.from('members').select('tracks, schools').eq('clerk_id', userId).maybeSingle(),
    ]);
    if (made > 0 && cur) {
      tracks = [...new Set([...(cur.tracks || []), ...tracks])];
      schools = [...new Set([...(cur.schools || []), ...schools])];
    }
    if (!tracks.length) return bad('Choose at least one exam you teach.');
    const needSchool = tracks.some((t) => NEEDS_SCHOOL.has(t));
    if (needSchool && !schools.length) return bad('Choose the school you teach for.');
    row.tracks = tracks;
    row.schools = needSchool ? schools : [];
  }

  // Email is kept so we can find a tutor when they ask to be activated.
  try {
    const user = await currentUser();
    row.email = user?.primaryEmailAddress?.emailAddress?.slice(0, 200) || null;
    if (role === 'student' && !row.display_name) row.display_name = cleanText(user?.fullName || user?.firstName, 80);
  } catch {}

  // A student must have a name. Keep the one already saved if nothing new came in.
  if (role === 'student' && !row.display_name) {
    const { data: cur } = await db().from('members').select('display_name').eq('clerk_id', userId).maybeSingle();
    if (cur?.display_name?.trim()) row.display_name = cur.display_name;
    else return bad('Enter your name.');
  }

  const supabase = db();
  const { error } = await supabase.from('members').upsert(row, { onConflict: 'clerk_id' });
  if (error) return bad('Could not save. Try again.', 500);

  if (role === 'tutor') {
    // Insert only. An existing row (activation, free session used) is never reset from here.
    const { error: tErr } = await supabase
      .from('tutor_accounts')
      .upsert({ clerk_id: userId }, { onConflict: 'clerk_id', ignoreDuplicates: true });
    if (tErr) return bad('Could not save. Try again.', 500);
  }

  return NextResponse.json({ ok: true });
}