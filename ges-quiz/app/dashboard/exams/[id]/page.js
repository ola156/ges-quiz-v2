import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { auth } from '@clerk/nextjs/server';
import ExamEditor from '../../../../components/ExamEditor';
import { db } from '../../../../lib/supabase';
import { getMember } from '../../../../lib/member';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Exam | Instrict Quizmate', robots: { index: false, follow: false } };

export default async function ExamPage({ params }) {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');
  const member = await getMember(userId);
  if (!member || member.role !== 'tutor') redirect('/dashboard');

  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = db();
  const { data: exam } = await supabase
    .from('quizzes')
    .select('id, slug, title, description, time_limit_minutes, opens_at, closes_at, show_score, ask_department, ask_level, allow_calculator, track, school')
    .eq('id', id).eq('tutor_id', userId).maybeSingle();
  if (!exam) notFound();

  const [{ data: qs }, { count }] = await Promise.all([
    supabase.from('questions').select('id, subject, text, options, answer, explanation').eq('quiz_id', id).order('position'),
    supabase.from('submissions').select('id', { count: 'exact', head: true }).eq('quiz_id', id),
  ]);

  // Group the saved questions back into their subjects, in order.
  const subjects = [];
  for (const q of qs || []) {
    const name = q.subject || '';
    let s = subjects.find((x) => x.name === name);
    if (!s) {
      s = { k: subjects.length + 1000, name, questions: [], paste: '', pasteMsg: '' };
      subjects.push(s);
    }
    s.questions.push({ k: s.k * 1000 + s.questions.length, id: q.id, text: q.text, options: q.options, answer: q.answer, explanation: q.explanation || '' });
  }
  if (!subjects.length) subjects.push({ k: 1000, name: '', questions: [], paste: '', pasteMsg: '' });

  return (
    <div className="stack">
        <Link href="/dashboard/exams" className="back">Back to my exams</Link>
        <h1>{exam.title}</h1>
        <Link href={`/dashboard/exams/${exam.id}/results`} className="srow go" style={{ borderTop: '1px solid var(--surface-line)', borderBottom: '1px solid var(--surface-line)' }}>
          <span className="t">View results<small>{count || 0} handed in</small></span>
        </Link>
        <ExamEditor exam={exam} initialSubjects={subjects} attempts={count || 0} scope={{ tracks: member.tracks || [], schools: member.schools || [] }} />
    </div>
  );
}