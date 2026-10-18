'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { SCHOOLS, schoolName } from '../lib/schools';

const TRACKS = [
  { id: 'jamb', title: 'JAMB', note: 'UTME practice and mock exams' },
  { id: 'waec', title: 'WAEC', note: 'SSCE and GCE preparation' },
  { id: 'post_utme', title: 'Post-UTME', note: 'Screening for the school you applied to' },
  { id: 'university', title: 'University', note: 'Course quizzes for your department' },
];
const NEEDS_SCHOOL = ['post_utme', 'university'];
const CLASS_LEVELS = ['100', '200', '300', '400', '500', '600'];

// Pick from the fixed school list, so the same school is never saved under two spellings.
function SchoolPicker({ value, onChange, max = 10 }) {
  const [q, setQ] = useState('');
  const ql = q.trim().toLowerCase();
  const matches = ql
    ? SCHOOLS.filter((x) => !value.includes(x.id) && (x.name.toLowerCase().includes(ql) || x.short.toLowerCase().includes(ql))).slice(0, 6)
    : [];
  const add = (id) => {
    onChange(max === 1 ? [id] : [...value, id].slice(0, max));
    setQ('');
  };
  return (
    <div className="stack tight">
      {value.length > 0 && (
        <div className="chips">
          {value.map((id) => (
            <span key={id} className="chip">
              {schoolName(id)}{' '}
              <button type="button" onClick={() => onChange(value.filter((v) => v !== id))} aria-label={`Remove ${schoolName(id)}`}
                style={{ background: 'none', border: 0, color: 'inherit', cursor: 'pointer', font: 'inherit', padding: 0 }}>x</button>
            </span>
          ))}
        </div>
      )}
      {(max > 1 || !value.length) && (
        <input value={q} onChange={(e) => setQ(e.target.value)} autoComplete="off" placeholder="Type your school, e.g. UI or Ibadan" aria-label="Search schools" />
      )}
      {matches.map((x) => (
        <button type="button" key={x.id} className="btn sm ghost" style={{ textAlign: 'left', justifyContent: 'flex-start' }} onClick={() => add(x.id)}>
          {x.name}
        </button>
      ))}
      {ql && !matches.length && <p className="muted small">No school matches that. Check the spelling, or message us and we will add it.</p>}
    </div>
  );
}

export default function Onboarding({ startRole, fullName, initial }) {
  const router = useRouter();
  const [role, setRole] = useState(startRole);
  const [track, setTrack] = useState(initial?.track || '');
  const [school, setSchool] = useState(initial?.school || '');
  const [department, setDepartment] = useState(initial?.department || '');
  const [classLevel, setClassLevel] = useState(initial?.classLevel || '');
  const [displayName, setDisplayName] = useState(initial?.displayName || fullName || '');
  const [centre, setCentre] = useState(initial?.centre || '');
  const [tracks, setTracks] = useState(initial?.tracks || []);
  const [schools, setSchools] = useState(initial?.schools || []);
  const needsSchools = tracks.some((t) => NEEDS_SCHOOL.includes(t));
  const toggleTrack = (id) => setTracks((all) => (all.includes(id) ? all.filter((t) => t !== id) : [...all, id]));
  // student: track -> details (only when a school is needed). tutor: one form.
  const [stage, setStage] = useState(startRole === 'student' && initial?.track && NEEDS_SCHOOL.includes(initial.track) ? 'details' : 'main');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function save(payload) {
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/me/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not save. Try again.');
      router.push('/dashboard');
      router.refresh();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  function pickTrack(id) {
    setTrack(id);
    setError('');
    if (NEEDS_SCHOOL.includes(id)) setStage('details');
    else save({ role: 'student', track: id });
  }

  function back() {
    setError('');
    if (role === 'student' && stage === 'details') { setStage('main'); return; }
    setRole(null);
  }

  if (!role) {
    return (
      <section className="panel stack">
        <h1>How will you use Instrict Quizmate?</h1>
        <div className="stack tight">
          <button type="button" className="pick" onClick={() => { setRole('student'); setStage('main'); }}>
            <strong>I am a student</strong>
            <span>Practice for an exam and track how you are doing</span>
          </button>
          <button type="button" className="pick" onClick={() => { setRole('tutor'); setStage('main'); }}>
            <strong>I am a tutor</strong>
            <span>Run timed exams for a class or a tutorial centre</span>
          </button>
        </div>
      </section>
    );
  }

  if (role === 'tutor') {
    const ready = displayName.trim() && tracks.length && (!needsSchools || schools.length);
    return (
      <form
        className="panel stack"
        onSubmit={(e) => { e.preventDefault(); save({ role: 'tutor', displayName, centre, tracks, schools: needsSchools ? schools : [] }); }}>
        <button type="button" className="back-btn" onClick={back}>Back</button>
        <h1>Set up your tutor account</h1>
        <p className="muted">Your first session is free. This tells us where your exams belong.</p>
        <label>Your name
          <input required maxLength={80} autoComplete="name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
        </label>
        <label>Tutorial centre (optional)
          <input maxLength={80} value={centre} onChange={(e) => setCentre(e.target.value)} />
        </label>
        <div className="stack tight">
          <strong>What do you teach?</strong>
          <span className="muted small">Pick every exam you prepare students for.</span>
          {TRACKS.map((t) => (
            <button type="button" key={t.id} className={`pick ${tracks.includes(t.id) ? 'on' : ''}`} onClick={() => toggleTrack(t.id)} aria-pressed={tracks.includes(t.id)}>
              <strong>{t.title}</strong>
              <span>{t.note}</span>
            </button>
          ))}
        </div>
        {needsSchools && (
          <div className="stack tight">
            <strong>Which school do you teach for?</strong>
            <span className="muted small">
              Your University and Post-UTME exams stay inside the school you pick, so they never mix with another school's. Pick more than one only if you really teach at several.
            </span>
            <SchoolPicker value={schools} onChange={setSchools} />
            {initial?.hasExams && <span className="muted small">You already have exams, so what you picked before cannot be removed here. Message us if you picked wrongly.</span>}
          </div>
        )}
        {error && <p className="error" role="alert">{error}</p>}
        <button className="btn" disabled={busy || !ready}>{busy ? 'Saving...' : 'Continue'}</button>
      </form>
    );
  }

  if (stage === 'details') {
    const isUni = track === 'university';
    return (
      <form
        className="panel stack"
        onSubmit={(e) => { e.preventDefault(); save({ role: 'student', track, school, department, classLevel }); }}>
        <button type="button" className="back-btn" onClick={back}>Back</button>
        <h1>{isUni ? 'Which university?' : 'Which school did you apply to?'}</h1>
        <div className="stack tight">
          <strong>{isUni ? 'University' : 'School'}</strong>
          <SchoolPicker value={school ? [school] : []} onChange={(v) => setSchool(v[0] || '')} max={1} />
        </div>
        {isUni && (
          <>
            <label>Department (optional)
              <input maxLength={80} autoComplete="off" value={department} onChange={(e) => setDepartment(e.target.value)} />
            </label>
            <label>Level (optional)
              <select value={classLevel} onChange={(e) => setClassLevel(e.target.value)}>
                <option value="">Select level</option>
                {CLASS_LEVELS.map((l) => <option key={l} value={l}>{l} level</option>)}
              </select>
            </label>
          </>
        )}
        {error && <p className="error" role="alert">{error}</p>}
        <button className="btn" disabled={busy || !school.trim()}>{busy ? 'Saving...' : 'Continue'}</button>
      </form>
    );
  }

  return (
    <section className="panel stack">
      <button type="button" className="back-btn" onClick={back}>Back</button>
      <h1>What are you preparing for?</h1>
      <div className="stack tight">
        {TRACKS.map((t) => (
          <button type="button" key={t.id} className={`pick ${track === t.id ? 'on' : ''}`} disabled={busy} onClick={() => pickTrack(t.id)}>
            <strong>{t.title}</strong>
            <span>{t.note}</span>
          </button>
        ))}
      </div>
      {error && <p className="error" role="alert">{error}</p>}
    </section>
  );
}