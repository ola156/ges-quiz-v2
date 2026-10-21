import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@clerk/nextjs/server';
import CodeBox from '../../components/CodeBox';
import MathText from '../../components/MathText';
import { getMember, getTutorAccount, tutorStatus, tutorReady, TRACKS } from '../../lib/member';
import { schoolName } from '../../lib/schools';
import { listSubjects, getProgress, flatten, isDone, statusText } from '../../lib/study';
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
      {member.role === 'tutor' ? <TutorView member={member} userId={userId} /> : <StudentView member={member} userId={userId} />}
    </div>
  );
}

// "2 days ago" for the line under the Continue row.
function ago(iso) {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (!Number.isFinite(m) || m < 0) return '';
  if (m < 2) return 'just now';
  if (m < 60) return `${m} minutes ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} hour${h === 1 ? '' : 's'} ago`;
  const d = Math.round(h / 24);
  return d < 14 ? `${d} day${d === 1 ? '' : 's'} ago` : 'a while ago';
}

// Where the student should pick up: the subtopic touched most recently if it is not done yet.
// If that one is done, the next unfinished one in the same subject. A new student starts at the first.
function resumePoint(subjects, progress) {
  const flat = subjects.flatMap((sj) => flatten(sj).map((s) => ({ sj, s, p: progress[s.id] })));
  const last = flat
    .filter((x) => x.p?.updated_at)
    .sort((a, b) => new Date(b.p.updated_at) - new Date(a.p.updated_at))[0];
  if (last && !isDone(last.p)) return { ...last, label: 'Continue where you stopped' };
  if (last) {
    const same = flat.filter((x) => x.sj.id === last.sj.id);
    const at = same.indexOf(last);
    const nxt = same.slice(at + 1).find((x) => !isDone(x.p)) || same.find((x) => !isDone(x.p));
    if (nxt) return { ...nxt, label: 'Up next' };
  }
  const first = flat.find((x) => !isDone(x.p));
  return first ? { ...first, label: last ? 'Up next' : 'Start here' } : null;
}

async function StudentView({ member, userId }) {
  const subjects = await listSubjects(member.track, member.school);
  const progress = subjects.length ? await getProgress(userId) : {};
  const track = TRACKS[member.track] || 'your exam';
  const detail = [schoolName(member.school), member.department, member.class_level ? `${member.class_level} level` : null]
    .filter(Boolean)
    .join(', ');

  const rows = subjects.map((sj) => {
    const flat = flatten(sj);
    return { sj, total: flat.length, done: flat.filter((s) => isDone(progress[s.id])).length };
  });
  const resume = subjects.length ? resumePoint(subjects, progress) : null;

  // The course the student worked on last. Falls back to the first course for a new student.
  let lastId = null;
  let lastAt = 0;
  for (const sj of subjects) {
    for (const s of flatten(sj)) {
      const t = progress[s.id]?.updated_at ? new Date(progress[s.id].updated_at).getTime() : 0;
      if (t > lastAt) { lastAt = t; lastId = sj.id; }
    }
  }
  const focusId = resume?.sj.id ?? lastId ?? subjects[0]?.id;
  const focus = rows.find((r) => r.sj.id === focusId) || rows[0];
  const pct = focus && focus.total ? Math.round((focus.done / focus.total) * 100) : 0;
  // Only two courses on the dashboard: the last one studied, then the next one still to do.
  const others = rows.filter((r) => r !== focus);
  const next = others.find((r) => r.done < r.total) || others[0];
  const shown = focus ? [focus, next].filter(Boolean) : [];

  return (
    <>
      <header className="dh-head">
        <h1>{member.display_name ? `Welcome, ${member.display_name}` : 'Welcome'}</h1>
        <p className="muted"> {track === 'university' ? 'Preparing for' : 'Enrolled At'} {detail ? `: ${detail}` : ''}</p>
      </header>

      {subjects.length > 0 ? (
        <>
          {resume ? (
            <Link href={`/study/${resume.sj.exam}/${resume.sj.id}/${resume.s.id}`} className="dh-resume">
              <span className="dh-resume-text">
                <span className="dh-label">{resume.label}</span>
                <strong className="dh-resume-title"><MathText text={resume.s.title} /></strong>
                <span className="dh-resume-sub"><MathText text={resume.sj.name} />. <MathText text={resume.s.topicTitle} /></span>
                <span className="dh-resume-status">
                  {statusText(resume.p)}
                  {resume.p?.updated_at && resume.label !== 'Up next' ? `. Last studied ${ago(resume.p.updated_at)}` : ''}
                </span>
              </span>
              <span className="dh-resume-go" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14 M13 6l6 6-6 6" /></svg>
              </span>
            </Link>
          ) : (
            <p className="dh-finished">You have finished every subtopic. Open any subject below to revise.</p>
          )}

          <section className="dh-block">
            <div className="dh-block-head">
              <span className="dh-label">{focus ? <MathText text={focus.sj.name} /> : 'Your progress'}</span>
              <span className="muted small">{focus?.done ?? 0} of {focus?.total ?? 0} subtopics done</span>
            </div>
            <div className="dh-meter" role="progressbar" aria-label="Course progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
              <span style={{ width: `${pct}%` }} />
            </div>
            <ul className="slist">
              {shown.map(({ sj, total, done }) => (
                <li key={sj.id}>
                  <Link href={`/study/${sj.exam}/${sj.id}`} className="srow go">
                    <span className="t">
                      <MathText text={sj.name} />
                      <small>{done === total ? 'All subtopics done' : `${done} of ${total} subtopics done`}</small>
                    </span>
                    {done === total ? <span className="tick" aria-label="Complete">&#10003;</span> : <span className="m">{Math.round((done / total) * 100)}%</span>}
                  </Link>
                </li>
              ))}
            </ul>
            {rows.length > 2 && <Link href="/study" className="text-link">See all {rows.length} subjects</Link>}
          </section>
        </>
      ) : (
        <section className="dh-block">
          <span className="dh-label">Study</span>
          <p className="muted">{track} study is not ready yet. If your tutor gave you a code or link, you can use it below.</p>
        </section>
      )}

      <section className="dh-block">
        <span className="dh-label">Practice</span>
        <ul className="slist">
          <li>
            <Link href="/practice" className="srow go">
              <span className="t">
                Practice quizzes
                <small>{member.track === 'university' ? 'Course quizzes with instant corrections and leaderboards' : `Public quizzes for ${track}, with corrections`}</small>
              </span>
            </Link>
          </li>
        </ul>
      </section>

      <section className="dh-block">
        <label className="dh-label" htmlFor="home-code">Have a code?</label>
        <CodeBox variant="line" />
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