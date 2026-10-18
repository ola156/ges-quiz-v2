import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@clerk/nextjs/server';
import CodeBox from '../../components/CodeBox';
import { getMember, getTutorAccount, tutorStatus, tutorReady, TRACKS } from '../../lib/member';
import { schoolName } from '../../lib/schools';
import { listSubjects } from '../../lib/study';
import { db } from '../../lib/supabase';
import { examState, lagos } from '../../lib/exam';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Dashboard | Instrict Quizmate', robots: { index: false, follow: false } };

export default async function Dashboard() {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');
  const member = await getMember(userId);
  if (!member) redirect('/onboarding');

  return (
    <div className="stack">
      {member.role === 'tutor' ? <TutorView member={member} userId={userId} /> : <StudentView member={member} />}
    </div>
  );
}

async function StudentView({ member }) {
  const hasStudy = (await listSubjects(member.track, member.school)).length > 0;
  const track = TRACKS[member.track] || 'your exam';
  const detail = [schoolName(member.school), member.department, member.class_level ? `${member.class_level} level` : null]
    .filter(Boolean)
    .join(', ');
  return (
    <>
      <h1>{member.display_name ? `Welcome, ${member.display_name}` : 'Welcome'}</h1>

      <section className="card stack tight">
        <h2 className="card-h">Preparing for {track}</h2>
        {detail && <p className="muted small">{detail}</p>}
        <Link href="/profile" className="text-link">View profile</Link>
      </section>

      {member.track === 'university' ? (
        <section className="card stack tight">
          <h2 className="card-h">Practice sets</h2>
          <p className="muted small">Course quizzes with instant corrections and leaderboards.</p>
          <Link href="/practice" className="btn">Open practice sets</Link>
        </section>
      ) : hasStudy ? (
        <section className="card stack tight">
          <h2 className="card-h">Study {track}</h2>
          <p className="muted small">Short notes, then a quiz for every topic. Corrections explain each answer.</p>
          <Link href="/study" className="btn">Open study</Link>
        </section>
      ) : (
        <section className="card stack tight">
          <h2 className="card-h">{track} study is being prepared</h2>
          <p className="muted small">It is not ready yet. If your tutor gave you a code or link, you can use it below.</p>
        </section>
      )}

      <section className="card stack tight">
        <h2 className="card-h">Have a code?</h2>
        <CodeBox />
      </section>
    </>
  );
}

async function TutorView({ member }) {
  const account = await getTutorAccount(member.clerk_id);
  const status = tutorStatus(account);
  const number = String(process.env.NEXT_PUBLIC_CONTACT_WHATSAPP || '').replace(/\D/g, '');
  const text = `Hello, please activate my tutor account on Instrict Quizmate.${member.email ? ` My email is ${member.email}.` : ''}`;
  const wa = number ? `https://wa.me/${number}?text=${encodeURIComponent(text)}` : '';

  const { data: exams } = await db()
    .from('quizzes')
    .select('id, slug, title, opens_at, closes_at, created_at, questions(count), submissions(count)')
    .eq('tutor_id', member.clerk_id)
    .order('created_at', { ascending: false });
  const ready = tutorReady(member);
  const canCreate = (status === 'active' || status === 'trial') && ready;
  const teaches = (member.tracks || []).map((t) => TRACKS[t]).filter(Boolean).join(', ');
  const schoolsLine = (member.schools || []).map(schoolName).join(', ');

  return (
    <>
      <h1>{member.display_name ? `Welcome, ${member.display_name}` : 'Welcome'}</h1>
      {member.centre && <p className="muted">{member.centre}</p>}
      {teaches && <p className="muted small">{teaches}{schoolsLine ? `. ${schoolsLine}` : ''}</p>}

      {!ready && (
        <section className="card stack tight">
          <h2 className="card-h">Finish setting up your account</h2>
          <p className="muted small">Tell us what you teach and which school, so your exams are filed in the right place.</p>
          <Link href="/onboarding?edit=1" className="btn">Finish setting up</Link>
        </section>
      )}

      {status === 'trial' && (
        <p className="card small">Your first exam is free. After it, message us on WhatsApp to activate your account.</p>
      )}
      {status === 'locked' && (
        <section className="card stack tight">
          <h2 className="card-h">Your free session has been used</h2>
          <p className="muted small">Message us on WhatsApp and we will activate your account. You can still open your exam and download its results.</p>
          {wa ? <a className="btn wa" href={wa} target="_blank" rel="noreferrer">Message us on WhatsApp</a> : null}
        </section>
      )}

      <section className="stack tight">
        <div className="row between">
          <h2>Newest exams</h2>
          {canCreate && <Link href="/dashboard/exams/new" className="btn sm">Create an exam</Link>}
        </div>
        {!exams?.length && (
          <p className="muted small">
            {canCreate
              ? 'You have no exams yet. Create one, give students the link or code, and their results appear here as they finish. Students never need an account.'
              : 'You have no exams.'}
          </p>
        )}
        {(exams || []).slice(0, 3).map((x) => {
          const state = examState(x);
          return (
            <div key={x.id} className="card stack tight">
              <strong>{x.title}</strong>
              <div className="chips">
                <span className="chip">{state === 'open' ? 'Open' : state === 'scheduled' ? `Opens ${lagos(x.opens_at)}` : 'Closed'}</span>
                <span className="chip">{x.questions?.[0]?.count ?? 0} questions</span>
                <span className="chip">{x.submissions?.[0]?.count ?? 0} handed in</span>
                <span className="chip">Code: {x.slug}</span>
              </div>
              <div className="row">
                <Link href={`/dashboard/exams/${x.id}`} className="btn sm">Manage</Link>
                <Link href={`/dashboard/exams/${x.id}/results`} className="btn sm ghost">Results</Link>
              </div>
            </div>
          );
        })}
        {(exams?.length || 0) > 3 && <Link href="/dashboard/exams" className="text-link">See all {exams.length} exams</Link>}
      </section>

    </>
  );
}