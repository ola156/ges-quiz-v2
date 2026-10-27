import { db } from './supabase';

export const TRACKS = {
  jamb: 'JAMB',
  waec: 'JAMB', // WAEC content is the same as JAMB, so students only ever see JAMB
  post_utme: 'Post-UTME',
  university: 'University',
};
// WAEC and JAMB share their content. Everything in the app treats a WAEC record as JAMB.
export const normTrack = (t) => (t === 'waec' ? 'jamb' : t || 'university');

export const NEEDS_SCHOOL = new Set(['post_utme', 'university']);
export const CLASS_LEVELS = ['100', '200', '300', '400', '500', '600'];

const MEMBER_COLS = 'clerk_id, role, email, display_name, track, school, department, class_level, centre, tracks, schools';

export async function getMember(clerkId) {
  if (!clerkId) return null;
  const { data } = await db().from('members').select(MEMBER_COLS).eq('clerk_id', clerkId).maybeSingle();
  if (!data) return null;
  if (data.track) data.track = normTrack(data.track);
  if (Array.isArray(data.tracks)) data.tracks = [...new Set(data.tracks.map(normTrack))];
  return data;
}

// True when the person has given us a name. Students who signed up by email code before names were required may not have one.
export const hasName = (member) => Boolean(member?.display_name && member.display_name.trim());

export async function getTutorAccount(clerkId) {
  if (!clerkId) return null;
  const { data } = await db()
    .from('tutor_accounts')
    .select('clerk_id, active, free_session_used')
    .eq('clerk_id', clerkId)
    .maybeSingle();
  return data || null;
}

// What a tutor can do right now.
//   active : activated by us, no limits
//   trial  : not activated yet, first session still free
//   locked : free session used, waiting for activation
export function tutorStatus(account) {
  if (!account) return 'none';
  if (account.active) return 'active';
  return account.free_session_used ? 'locked' : 'trial';
}

// A tutor can create exams only after saying what they teach. Anything for University or Post-UTME
// also needs at least one school, because those exams are kept inside that school.
export function tutorReady(member) {
  const tracks = member?.tracks || [];
  if (!tracks.length) return false;
  return !tracks.some((t) => NEEDS_SCHOOL.has(t)) || (member.schools || []).length > 0;
}