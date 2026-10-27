import { auth } from '@clerk/nextjs/server';
import PracticeList from '../../components/PracticeList';
import { getMember, normTrack, TRACKS } from '../../lib/member';
import { getPublishedQuizzes } from '../../lib/data';
import { schoolName } from '../../lib/schools';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Practice | Instrict Quizmate' };

// Public quizzes a student can take. A student sees the pool for the exam and school they chose
// at sign-up. Quizzes that were public before exams were tagged count as University.
export default async function Practice() {
  const { userId } = await auth();
  const [member, all] = await Promise.all([userId ? getMember(userId) : null, getPublishedQuizzes()]);

  const student = member && member.role !== 'tutor' ? member : null;
  const pool = student
    ? all.filter((q) => {
        if (normTrack(q.track) !== student.track) return false;
        return !q.school || q.school === student.school;
      })
    : all;

  const items = pool.map((q) => ({
    slug: q.slug,
    title: q.title,
    course: (q.course || '').trim(),
    description: q.description || '',
    count: q.questions?.[0]?.count ?? 0,
    minutes: q.time_limit_minutes || 0,
  }));

  const label = student ? [TRACKS[student.track], student.school ? schoolName(student.school) : ''].filter(Boolean).join(', ') : '';
  return <PracticeList items={items} label={label} signedIn={Boolean(member)} track={student?.track || ''} custom={Boolean(student)} />;
}