import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '../../../lib/supabase';
import { sameOrigin } from '../../../lib/guard';
import { getMember } from '../../../lib/member';
import { JAMB_SUBJECTS, subjectKey } from '../../../lib/jambsubjects';

const MAX_VOTES = 3;
const bad = (msg, status = 400) => NextResponse.json({ error: msg }, { status });

// A student switches a vote for a subject on or off. Up to 3 votes each.
export async function POST(req) {
  const { userId } = await auth();
  if (!userId) return bad('Please sign in again.', 401);
  if (!sameOrigin(req)) return bad('Request refused.', 403);
  let body;
  try { body = await req.json(); } catch { return bad('Bad request'); }

  const member = await getMember(userId);
  if (!member || member.track !== 'jamb') return bad('Voting is open to JAMB students.', 403);
  const key = subjectKey(body.subject);
  if (!JAMB_SUBJECTS.some((s) => subjectKey(s) === key)) return bad('Unknown subject');

  const supabase = db();
  const { data: mine } = await supabase.from('subject_votes').select('subject').eq('clerk_id', userId);
  const has = (mine || []).some((v) => v.subject === key);
  if (has) {
    const { error } = await supabase.from('subject_votes').delete().eq('clerk_id', userId).eq('subject', key);
    if (error) return bad('Could not save your vote.', 500);
    return NextResponse.json({ voted: false });
  }
  if ((mine || []).length >= MAX_VOTES) return bad(`You can vote for up to ${MAX_VOTES} subjects. Remove one first.`);
  const { error } = await supabase.from('subject_votes').insert({ clerk_id: userId, subject: key });
  if (error) return bad('Could not save your vote.', 500);
  return NextResponse.json({ voted: true });
}