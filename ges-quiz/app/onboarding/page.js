import { redirect } from 'next/navigation';
import { auth, currentUser } from '@clerk/nextjs/server';
import SiteHeader from '../../components/SiteHeader';
import Onboarding from '../../components/Onboarding';
import { getMember } from '../../lib/member';
import { db } from '../../lib/supabase';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Set up your account | Instrict Quizmate' };

export default async function OnboardingPage({ searchParams }) {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');
  const { role, edit } = await searchParams;

  const member = await getMember(userId);
  if (member && !edit) redirect('/dashboard');

  let fullName = '';
  try {
    const u = await currentUser();
    fullName = [u?.firstName, u?.lastName].filter(Boolean).join(' ');
  } catch {}

  let hasExams = false;
  if (member?.role === 'tutor') {
    const { count } = await db().from('quizzes').select('id', { count: 'exact', head: true }).eq('tutor_id', userId);
    hasExams = count > 0;
  }

  const startRole = role === 'tutor' ? 'tutor' : role === 'student' ? 'student' : member?.role || null;

  return (
    <div className="lp">
      <SiteHeader />
      <Onboarding
        startRole={startRole}
        fullName={fullName}
        initial={member ? {
          track: member.track || '',
          school: member.school || '',
          department: member.department || '',
          classLevel: member.class_level || '',
          displayName: member.display_name || '',
          centre: member.centre || '',
          tracks: member.tracks || [],
          schools: member.schools || [],
          hasExams,
        } : null}
      />
    </div>
  );
}