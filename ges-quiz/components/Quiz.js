'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Board from './Board';
import Rich from './Rich';
import Calculator from './Calculator';
import { PARTNER } from '../lib/brand';
import { examMinutes } from '../lib/exam';

const LEVELS = ['100', '200', '300', '400', '500', '600'];
const LETTERS = ['A', 'B', 'C', 'D', 'E'];
const mmss = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
const SIX_HOURS = 6 * 3600;
// Options like "All of the above" or "Both A and B" only make sense in their original order.
const KEEP_ORDER = /\b(above|below)\b|\b(all|none) of (these|the)\b|\bboth\b|\bneither\b|^\s*\(?[a-e]\)?\s*(and|&|,)\s*\(?[a-e]\)?\b/i;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Each attempt gets its own question order and option order. Answers are always stored
// against the original option index, so the server can mark them without knowing the order.
function makePlan(questions) {
  const opts = {};
  for (const q of questions) {
    const idx = q.options.map((_, k) => k);
    opts[q.id] = q.options.some((o) => KEEP_ORDER.test(o)) ? idx : shuffle(idx);
  }
  // Exams with subjects keep the subjects in order and shuffle inside each one.
  const groups = [];
  const at = new Map();
  for (const q of questions) {
    const key = q.subject || '';
    if (!at.has(key)) { at.set(key, groups.length); groups.push([]); }
    groups[at.get(key)].push(q.id);
  }
  return { qs: groups.flatMap(shuffle), opts };
}

// Always a v4 UUID, because the server rejects anything else.
function makeUuid() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

function getClientId() {
  try {
    let id = localStorage.getItem('clientId');
    if (!id || !UUID_RE.test(id)) {
      id = makeUuid();
      localStorage.setItem('clientId', id);
    }
    return id;
  } catch {
    return makeUuid();
  }
}

// Details saved on this device from the first time. If they are complete, the form is skipped.
function savedProfile() {
  try {
    const p = JSON.parse(localStorage.getItem('profile') || 'null');
    return p && p.name && p.username && p.department && p.level ? p : null;
  } catch {
    return null;
  }
}

function pinIsSet() {
  try {
    return localStorage.getItem('pinSet') === '1';
  } catch {
    return false;
  }
}

// Styles for the "choose your subjects" step.
const PICK_CSS = `
.qp-pick { margin: 0; padding: 0; border: 0; min-width: 0; display: grid; gap: 8px; }
.qp-pick legend { padding: 0; font-weight: 700; font-size: 1.05rem; color: var(--head); }
.qp-list { list-style: none; margin: 0; padding: 0; border-top: 1px solid var(--surface-line); }
.qp-list li { border-bottom: 1px solid var(--surface-line); }
.qp-row { display: flex; align-items: center; gap: 14px; padding: 14px 4px; cursor: pointer; color: var(--on-dark); font-weight: 400; }
.qp-row:hover { background: var(--wash); }
.qp-row.on { background: var(--wash); }
.qp-row.off { opacity: 0.45; cursor: not-allowed; }
.qp-row input[type='checkbox'] { flex: none; width: 22px; height: 22px; padding: 0; accent-color: var(--blue); }
.qp-name { flex: 1; min-width: 0; font-weight: 600; color: var(--head); }
.qp-name small { display: block; margin-top: 2px; font-weight: 400; font-size: 0.85rem; color: var(--on-dark-muted); }
.qp-row em { font-style: normal; font-size: 0.75rem; font-weight: 700; padding: 2px 10px; border-radius: 99px; background: var(--wash-strong); color: var(--on-dark); }
.qp-count { color: var(--on-dark-muted); font-size: 0.85rem; }
`;

// Subjects named on the questions, in order. With "students pick their subjects" on, `picked` holds the ticked ones.
const subjectNames = (qs) => [...new Set(qs.map((x) => x.subject).filter(Boolean))];

const postJson = (url, body) =>
  fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

// Lets a student protect their username with a 4-digit PIN, once.
function PinCard({ onSaved }) {
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  async function save(e) {
    e.preventDefault();
    if (!/^\d{4}$/.test(pin)) {
      setMsg('Enter exactly 4 digits.');
      return;
    }
    setBusy(true);
    setMsg('');
    try {
      const res = await postJson('/api/pin', { clientId: getClientId(), pin });
      const data = await res.json();
      if (res.ok || data.already) {
        try { localStorage.setItem('pinSet', '1'); } catch {}
        onSaved(Boolean(res.ok));
        return;
      }
      setMsg(data.error || 'Could not save your PIN.');
    } catch {
      setMsg('No connection. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="card stack tight" onSubmit={save}>
      <strong>Protect your username</strong>
      <p className="muted small">
        Set a 4-digit PIN. If you clear your browser or change phones, enter your username and PIN to get your name and scores back.
      </p>
      <input
        type="tel"
        inputMode="numeric"
        autoComplete="off"
        placeholder="4-digit PIN"
        maxLength={4}
        value={pin}
        onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
      />
      {msg && <p className="error">{msg}</p>}
      <button className="btn" disabled={busy}>{busy ? 'Saving...' : 'Save PIN'}</button>
    </form>
  );
}

// Brings back an old username on this device. Not a form, so it can sit inside the first-time form screen.
function RestorePanel({ onRestored, onCancel }) {
  const [username, setUsername] = useState('');
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  async function restore() {
    if (!username.trim() || !/^\d{4}$/.test(pin)) {
      setMsg('Enter your username and your 4-digit PIN.');
      return;
    }
    setBusy(true);
    setMsg('');
    try {
      const res = await postJson('/api/restore', { username, pin });
      const data = await res.json();
      if (!res.ok) {
        setMsg(data.error || 'Could not restore.');
        return;
      }
      if (!UUID_RE.test(String(data.clientId))) {
        setMsg('Could not restore. Contact the admin.');
        return;
      }
      try {
        localStorage.setItem('clientId', data.clientId);
        localStorage.setItem('profile', JSON.stringify(data.profile));
        localStorage.setItem('pinSet', '1');
      } catch {}
      onRestored(data.profile);
    } catch {
      setMsg('No connection. Try again.');
    } finally {
      setBusy(false);
    }
  }

  const enter = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      restore();
    }
  };

  return (
    <div className="card stack tight">
      <strong>Restore my username</strong>
      <label>Username
        <input autoCapitalize="none" autoCorrect="off" maxLength={20} value={username} onKeyDown={enter} onChange={(e) => setUsername(e.target.value)} />
      </label>
      <label>4-digit PIN
        <input type="tel" inputMode="numeric" autoComplete="off" maxLength={4} value={pin} onKeyDown={enter} onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))} />
      </label>
      {msg && <p className="error">{msg}</p>}
      <div className="row">
        <button type="button" className="btn" disabled={busy} onClick={restore}>{busy ? 'Checking...' : 'Restore'}</button>
        <button type="button" className="btn ghost" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

export default function Quiz({ quiz, questions, initialBoard }) {
  const [step, setStep] = useState('intro'); // intro | quiz | saving | gate | result
  const [i, setI] = useState(0);
  const [answers, setAnswers] = useState({});
  const [plan, setPlan] = useState(null);
  const [token, setToken] = useState('');
  const [profile, setProfile] = useState({ name: '', username: '', department: '', level: '', whatsapp: '' });
  const [deps, setDeps] = useState([]);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [timedOut, setTimedOut] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [pinSet, setPinSet] = useState(true); // starts true so the PIN card never flashes for people who already set one
  const [pinFlash, setPinFlash] = useState('');
  const [showRestore, setShowRestore] = useState(false);
  const [calcOpen, setCalcOpen] = useState(false);
  const station = Boolean(quiz.station);
  const canPick = Boolean(station && quiz.pick_subjects && subjectNames(questions).length > 1);
  // null means every subject. With the picker on it is the list the student ticked (compulsory ones start ticked).
  const [picked, setPicked] = useState(() => (canPick ? subjectNames(questions).filter((n) => quiz.subject_config?.[n]?.required) : null));
  const pickedRef = useRef(picked);
  pickedRef.current = picked;
  const active = picked ? questions.filter((x) => picked.includes(x.subject)) : questions;
  const attemptRef = useRef('');
  const keyRef = useRef(null); // set while a question is on screen, so the keyboard shortcuts know where we are
   const creatorUrl = process.env.NEXT_PUBLIC_CREATOR_GROUP_URL || "";


  const limit = examMinutes(quiz, picked) * 60;
  const startRef = useRef(0);
  const booted = useRef(false);
  const answersRef = useRef({});
  const tokenRef = useRef('');
  answersRef.current = answers;
  tokenRef.current = token;
  const [left, setLeft] = useState(limit);

  const stateKey = `quizState:${quiz.id}`;
  // On a shared laptop an unfinished attempt must not carry over to the next student,
  // so tutor exams keep it only for the life of the tab.
  const keep = () => (station ? window.sessionStorage : window.localStorage);
  const byId = Object.fromEntries(questions.map((qq) => [qq.id, qq]));
  const ordered = plan ? plan.qs.map((id) => byId[id]) : active;
  const q = ordered[i];
  const last = i === ordered.length - 1;
  const courseHref = quiz.course ? `/leaderboard/${encodeURIComponent(quiz.course)}` : null;
  const creator = quiz.creators || null;
  const collection = quiz.collections || null;

  // Marks the quiz. Used by the form (first time) and automatically for returning players.
  async function submit(p) {
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quizId: quiz.id,
          answers: answersRef.current,
          profile: p,
          subjects: pickedRef.current,
          clientId: station ? attemptRef.current || (attemptRef.current = makeUuid()) : getClientId(),
          token: tokenRef.current,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Something went wrong');
      if (station) {
        try { keep().removeItem(stateKey); } catch {}
      } else {
        const saved = { ...data.profile, whatsapp: p.whatsapp || '' };
        try {
          localStorage.setItem('profile', JSON.stringify(saved));
          localStorage.removeItem(stateKey);
        } catch {}
        setProfile((prev) => ({ ...prev, ...saved }));
      }
      setResult(data);
      setStep('result');
      window.scrollTo({ top: 0 });
    } catch (err) {
      setError(err.message);
      setStep('gate');
    } finally {
      setBusy(false);
    }
  }

  // Quiz is over: returning players go straight to their score, new players fill the form once.
  function goToScore(out) {
    setTimedOut(out);
    window.scrollTo({ top: 0 });
    if (station) {
      // The name was typed before the exam started, so go straight to marking.
      setStep('saving');
      submit(profile);
      return;
    }
    const p = savedProfile();
    if (p) {
      setProfile((prev) => ({ ...prev, ...p }));
      setStep('saving');
      submit(p);
    } else {
      setStep('gate');
    }
  }

  // On load: restore the saved profile, and resume an attempt that was interrupted by a refresh.
  useEffect(() => {
    if (booted.current) return;
    booted.current = true;
    const p = station ? null : savedProfile();
    if (p) setProfile((prev) => ({ ...prev, ...p }));
    setPinSet(pinIsSet());
    try {
      const s = JSON.parse(keep().getItem(stateKey) || 'null');
      if (!s || !s.plan || !s.token) return;
      const age = (Date.now() - s.startedAt) / 1000;
      const sp = canPick && Array.isArray(s.picked) ? s.picked.filter((n) => subjectNames(questions).includes(n)) : null;
      const act = sp ? questions.filter((x) => sp.includes(x.subject)) : questions;
      const lim = examMinutes(quiz, sp) * 60;
      const planOk =
        s.plan.qs.length === act.length &&
        s.plan.qs.every((id) => byId[id]) &&
        Object.entries(s.plan.opts).every(([id, o]) => byId[id] && byId[id].options.length === o.length);
      if (!planOk || age > SIX_HOURS) {
        keep().removeItem(stateKey);
        return;
      }
      if (station) {
        attemptRef.current = s.attemptId || '';
        if (s.profile) setProfile((prev) => ({ ...prev, ...s.profile }));
      }
      pickedRef.current = sp;
      setPicked(sp);
      startRef.current = s.startedAt;
      answersRef.current = s.answers || {};
      tokenRef.current = s.token;
      setPlan(s.plan);
      setToken(s.token);
      setAnswers(s.answers || {});
      setI(Math.min(s.i || 0, act.length - 1));
      if (s.phase === 'gate') {
        if (station) {
          setStep('gate');
          return;
        }
        goToScore(Boolean(s.timedOut));
      } else if (lim && age >= lim) {
        goToScore(true);
      } else {
        setLeft(lim ? Math.max(0, lim - Math.floor(age)) : 0);
        setStep('quiz');
      }
    } catch {}
  }, []);

  // Save progress after every answer so a refresh or a dropped connection costs nothing.
  useEffect(() => {
    if (step !== 'quiz' && step !== 'gate' && step !== 'saving') return;
    try {
      keep().setItem(stateKey, JSON.stringify({
        phase: step === 'quiz' ? 'quiz' : 'gate',
        startedAt: startRef.current, token, plan, answers, i, timedOut, picked,
        ...(station ? { attemptId: attemptRef.current, profile: { name: profile.name, department: profile.department, level: profile.level } } : {}),
      }));
    } catch {}
  }, [step, answers, i, token, plan, timedOut, picked]);

  // Department suggestions are only needed when the first-time form is on screen.
  useEffect(() => {
    const wantsDeps = station ? step === 'intro' && quiz.ask_department : step === 'gate';
    if (!wantsDeps || deps.length) return;
    fetch('/api/departments')
      .then((r) => r.json())
      .then((d) => setDeps(d.departments || []))
      .catch(() => {});
  }, [step]);

  // After a tutor exam is handed in, the screen goes back to the name box for the next student.
  useEffect(() => {
    if (!station || step !== 'result' || !result?.hidden) return;
    const t = setTimeout(() => window.location.reload(), 8000);
    return () => clearTimeout(t);
  }, [step, result]);

  // The server stamps the start time. This runs in the background so Start never waits.
  function fetchToken(tries) {
    fetch('/api/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quizId: quiz.id }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (!d.token) throw new Error('no token');
        tokenRef.current = d.token;
        setToken(d.token);
      })
      .catch(() => {
        if (tries > 1) setTimeout(() => fetchToken(tries - 1), 1500);
      });
  }

  function start() {
    startRef.current = Date.now();
    attemptRef.current = station ? makeUuid() : '';
    tokenRef.current = '';
    answersRef.current = {};
    setPlan(makePlan(active));
    setToken('');
    setAnswers({});
    setI(0);
    setTimedOut(false);
    setLeft(limit);
    setError('');
    setPinFlash('');
    setCalcOpen(false);
    setStep('quiz');
    window.scrollTo({ top: 0 });
    fetchToken(3);
  }

  useEffect(() => {
    if (step !== 'quiz' || !limit) return;
    const t = setInterval(() => {
      const remaining = limit - Math.floor((Date.now() - startRef.current) / 1000);
      if (remaining <= 0) {
        clearInterval(t);
        setLeft(0);
        goToScore(true);
      } else {
        setLeft(remaining);
      }
    }, 500);
    return () => clearInterval(t);
  }, [step, limit]);

  function onGate(e) {
    e.preventDefault();
    submit(profile);
  }

  function switchAccount() {
    const who = result?.username || profile.username;
    const warning = pinSet
      ? `Use a different name on this phone? You can get @${who} back later with your username and PIN.`
      : `You have not set a PIN, so you will not be able to get @${who} back. Press Cancel to set a PIN first, or OK to continue.`;
    if (!confirm(warning)) return;
    try {
      localStorage.removeItem('profile');
      localStorage.removeItem('clientId');
      localStorage.removeItem('pinSet');
    } catch {}
    window.location.reload();
  }

  function onPinSaved(fresh) {
    setPinSet(true);
    setPinFlash(fresh ? 'PIN saved. Remember it, you need it to restore your username.' : 'A PIN is already set for this username.');
  }

  // Restored from the first-time form: the quiz is already finished, so mark it straight away.
  function onRestoredAtGate(p) {
    setShowRestore(false);
    setProfile((prev) => ({ ...prev, ...p }));
    setPinSet(true);
    setStep('saving');
    submit(p);
  }

  function onRestoredAtIntro(p) {
    setShowRestore(false);
    setProfile((prev) => ({ ...prev, ...p }));
    setPinSet(true);
  }

  // Keyboard shortcuts: A to E choose an option, N next, P previous. One listener for the whole page.
  useEffect(() => {
    const onKey = (e) => keyRef.current && keyRef.current(e);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  keyRef.current = null;

  if (!questions.length) return <p className="muted">This quiz has no questions yet.</p>;

  if (step === 'intro' && station) {
    const subjects = [];
    for (const qq of questions) {
      const k = qq.subject || '';
      const found = subjects.find((x) => x.name === k);
      if (found) found.n += 1;
      else subjects.push({ name: k, n: 1 });
    }
    const cfg = quiz.subject_config || {};
    const maxPick = quiz.max_subjects || 0;
    const count = picked ? picked.length : subjects.length;
    const enough = !canPick || (count >= 1 && (!maxPick || count <= maxPick));
    const mins = examMinutes(quiz, picked);
    const anyRequired = subjects.some((x) => cfg[x.name]?.required);
    const toggle = (n) => {
      if (cfg[n]?.required) return;
      setPicked((cur) => (cur.includes(n) ? cur.filter((x) => x !== n) : [...cur, n]));
    };
    const ready = profile.name.trim() && (!quiz.ask_department || profile.department.trim()) && (!quiz.ask_level || profile.level) && enough;
    return (
      <form className="stack" onSubmit={(e) => { e.preventDefault(); if (ready) start(); }}>
        <style>{PICK_CSS}</style>
        <h1>{quiz.title}</h1>
        {quiz.host && <p className="muted">{quiz.host}</p>}
        {quiz.description && <p>{quiz.description}</p>}
        <p className="meta">
          {active.length} questions{mins ? `, ${mins} minutes in total` : ''}
        </p>
        {!canPick && subjects.length > 1 && (
          <div className="chips">
            {subjects.map((x) => <span key={x.name} className="chip">{x.name}: {x.n}</span>)}
          </div>
        )}
        <label>Your full name
          <input required autoComplete="off" maxLength={80} value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} />
        </label>
        {quiz.ask_department && (
          <label>Department
            <input required list="departments" autoComplete="off" maxLength={80} value={profile.department} onChange={(e) => setProfile({ ...profile, department: e.target.value })} />
            <datalist id="departments">{deps.map((d) => <option key={d} value={d} />)}</datalist>
          </label>
        )}
        {quiz.ask_level && (
          <label>Level
            <select required value={profile.level} onChange={(e) => setProfile({ ...profile, level: e.target.value })}>
              <option value="">Select level</option>
              {LEVELS.map((l) => <option key={l} value={l}>{l} level</option>)}
            </select>
          </label>
        )}
        {canPick && (
          <fieldset className="qp-pick">
            <legend>Choose your subjects</legend>
            <p className="muted small">
              {maxPick ? `Pick up to ${maxPick} subjects.` : 'Tick every subject you are writing.'}
              {anyRequired ? ' A subject marked Compulsory is already ticked for you.' : ''}
            </p>
            <ul className="qp-list">
              {subjects.map((x) => {
                const on = picked.includes(x.name);
                const req = Boolean(cfg[x.name]?.required);
                const full = !on && maxPick > 0 && picked.length >= maxPick;
                const m = !quiz.time_limit_minutes && cfg[x.name]?.minutes ? `, ${cfg[x.name].minutes} min` : '';
                return (
                  <li key={x.name}>
                    <label className={`qp-row ${on ? 'on' : ''} ${full ? 'off' : ''}`}>
                      <input type="checkbox" checked={on} disabled={req || full} onChange={() => toggle(x.name)} />
                      <span className="qp-name">{x.name}<small>{x.n} questions{m}</small></span>
                      {req && <em>Compulsory</em>}
                    </label>
                  </li>
                );
              })}
            </ul>
            <p className="qp-count">{maxPick ? `${picked.length} of ${maxPick} picked` : `${picked.length} picked`}</p>
          </fieldset>
        )}
        <p className="muted small">The timer starts when you press Start. Questions and options are shuffled.</p>
        <button className="btn" disabled={!ready}>Start</button>
        {canPick && !enough && <p className="muted small">Pick at least one subject to start.</p>}
      </form>
    );
  }

  if (step === 'intro')
    return (
      <section className="stack">
        <h1>{quiz.title}</h1>
        {quiz.course && <p className="muted">{quiz.course}</p>}
        {quiz.description && <p>{quiz.description}</p>}
        <p className="meta">
          {questions.length} questions{quiz.time_limit_minutes ? `, ${quiz.time_limit_minutes} minutes` : ''}
        </p>
        <p className="muted small">
          Questions and options are shuffled every time. You can retake as often as you like, and your newest score replaces your old one on the leaderboard.
        </p>

        {creator && (
          <div className="card presented">
            <span className="presented-label">Presented by</span>
            <div className="presented-head">
              {creator.photo_url && <img className="presented-photo" src={creator.photo_url} alt={creator.name} />}
              <div className="presented-who">
                <strong>{creator.name}</strong>
                {creator.post && <span className="muted small">{creator.post}</span>}
              </div>
              {creator.logo_url && <img className="presented-logo" src={creator.logo_url} alt="" />}
            </div>
            {creator.agenda && <p className="small presented-agenda">{creator.agenda}</p>}
            <span className="muted small">This set was made by its creator. It is not part of the GES quizzes.</span>
          </div>
        )}

        <h2>{PARTNER}</h2>
        {profile.username && profile.name && <p className="muted small">Playing as @{profile.username}</p>}
        {!profile.username && !showRestore && (
          <button type="button" className="btn ghost" onClick={() => setShowRestore(true)}>Played before? Restore my username</button>
        )}
        {!profile.username && showRestore && (
          <RestorePanel onRestored={onRestoredAtIntro} onCancel={() => setShowRestore(false)} />
        )}
        {profile.username && !pinSet && <PinCard onSaved={onPinSaved} />}
        {pinFlash && <p className="card small">{pinFlash}</p>}
        <button className="btn" onClick={start}>Start quiz</button>
        <h2>Top scores in this set</h2>
        <Board rows={initialBoard} />
        {courseHref && <Link href={courseHref}>See the {quiz.course} overall leaderboard</Link>}
        {collection && <Link href={`/c/${collection.code}`}>See all sets and the {collection.title} leaderboard</Link>}

<div className="card creator">
      <p className="muted">Want to turn your own department's lecture slides into interactive AI quizzes for your classmates? Tap here to join our early-access Creator Community.</p>
      <a className="btn ghost" target="_blank" rel="noreferrer" href={creatorUrl}>Join the Creator Community</a>
    </div>
      </section>
    );

  if (step === 'quiz') {
    const order = plan.opts[q.id];
    // Subjects: each one is its own tab with its own questions.
    const groups = [];
    ordered.forEach((qq, idx) => {
      const name = qq.subject || '';
      const g = groups[groups.length - 1];
      if (g && g.name === name) g.end = idx;
      else groups.push({ name, start: idx, end: idx });
    });
    const gi = groups.findIndex((g) => i >= g.start && i <= g.end);
    const grp = groups[gi];
    const multi = groups.length > 1;
    const inGroup = grp.end - grp.start + 1;
    const lastOfGroup = i === grp.end;
    const isLastQuestion = last;
    const openTab = (g) => {
      const firstOpen = ordered.slice(g.start, g.end + 1).findIndex((x) => answers[x.id] === undefined);
      setI(g.start + (firstOpen === -1 ? 0 : firstOpen));
      window.scrollTo({ top: 0 });
    };
    const submitNow = () => {
      const left = ordered.length - Object.keys(answers).length;
      if (left > 0 && !confirm(`You have ${left} unanswered ${left === 1 ? 'question' : 'questions'}. They count as wrong. Submit anyway?`)) return;
      goToScore(false);
    };
    const goNext = () => {
      if (!lastOfGroup) setI(i + 1);
      else if (!isLastQuestion) openTab(groups[gi + 1]);
    };
    keyRef.current = (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
      const t = e.target;
      if (t && (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable)) return;
      const k = String(e.key).toLowerCase();
      const pos = k.length === 1 ? 'abcde'.indexOf(k) : -1;
      if (pos >= 0 && pos < order.length) {
        e.preventDefault();
        setAnswers((a) => ({ ...a, [q.id]: order[pos] }));
      } else if (k === 'n') {
        e.preventDefault();
        goNext();
      } else if (k === 'p') {
        e.preventDefault();
        if (i > 0) setI(i - 1);
      }
    };
    const inThis = ordered.slice(grp.start, grp.end + 1);
    const doneHere = inThis.filter((x) => answers[x.id] !== undefined).length;
    return (
      <section className="stack">
        {multi && (
          <div role="tablist" aria-label="Subjects" style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4 }}>
            {groups.map((g, n) => {
              const done = ordered.slice(g.start, g.end + 1).filter((x) => answers[x.id] !== undefined).length;
              return (
                <button key={g.name} type="button" role="tab" aria-selected={n === gi}
                  className={`btn sm ${n === gi ? '' : 'ghost'}`} style={{ flex: '0 0 auto' }} onClick={() => openTab(g)}>
                  {g.name}
                </button>
              );
            })}
          </div>
        )}
        <div className="row between">
          <p className="meta">{multi ? `${grp.name}: question ${i - grp.start + 1} of ${inGroup}` : `Question ${i + 1} of ${ordered.length}`}</p>
          <div className="row">
            {quiz.allow_calculator && (
              <button type="button" className="btn sm ghost" aria-expanded={calcOpen} onClick={() => setCalcOpen((o) => !o)}>
                {calcOpen ? 'Hide' : 'Calculator'}
              </button>
            )}
            {limit > 0 && <span className={`timer ${left <= 60 ? 'low' : ''}`}>{mmss(left)}</span>}
          </div>
        </div>
        {quiz.allow_calculator && (
          <div style={{ display: calcOpen ? 'block' : 'none' }}>
            <Calculator />
          </div>
        )}
        {q.subject && !multi && <div className="chips"><span className="chip">{q.subject}</span></div>}
        <h2 className="qtext"><Rich text={q.text} /></h2>
        {q.image_url && <img className="qimg" src={q.image_url} alt="" />}
        <div className="stack tight">
          {order.map((orig, pos) => (
            <button
              key={orig}
              className={`opt ${answers[q.id] === orig ? 'picked' : ''}`}
              onClick={() => setAnswers({ ...answers, [q.id]: orig })}
            >
              <span className="letter">{LETTERS[pos]}</span>
              <span><Rich text={q.options[orig]} /></span>
            </button>
          ))}
        </div>
        <div className="row">
          <button className="btn ghost" disabled={i === 0} onClick={() => setI(i - 1)}>Previous</button>
          {isLastQuestion ? (
            <button className="btn" onClick={() => goToScore(false)}>{station ? 'Submit' : 'Submit and see my score'}</button>
          ) : lastOfGroup ? (
            <button className="btn" onClick={goNext}>Next subject: {groups[gi + 1].name}</button>
          ) : (
            <button className="btn" onClick={goNext}>Next</button>
          )}
        </div>
        <p className="muted small">Keyboard: A to {LETTERS[order.length - 1]} choose an answer, N next, P previous.</p>
        <div className="card stack tight" aria-label="Question numbers">
          <div className="row between">
            <strong className="small">{multi ? `${grp.name}: ` : ''}{doneHere} of {inGroup} answered</strong>
            <span className="muted small">{inGroup - doneHere} to go</span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {inThis.map((x, n) => {
              const idx = grp.start + n;
              const done = answers[x.id] !== undefined;
              const here = idx === i;
              return (
                <button
                  key={x.id}
                  type="button"
                  onClick={() => setI(idx)}
                  aria-current={here ? 'true' : undefined}
                  aria-label={`Question ${n + 1}, ${done ? 'answered' : 'not answered'}`}
                  style={{
                    width: 38, height: 38, borderRadius: 10, fontWeight: 700, cursor: 'pointer', font: 'inherit',
                    border: `2px solid ${here ? 'var(--blue-dark)' : done ? 'var(--blue)' : 'var(--line)'}`,
                    background: here ? 'var(--blue)' : done ? 'var(--tint)' : '#fff',
                    color: here ? '#fff' : done ? 'var(--blue-dark)' : 'var(--ink)',
                  }}
                >
                  {n + 1}
                </button>
              );
            })}
          </div>
          
        </div>
        {multi && !isLastQuestion && (
          <div><button type="button" className="btn sm ghost" onClick={submitNow}>Submit the whole exam now</button></div>
        )}
        {isLastQuestion && Object.keys(answers).length < ordered.length && (
          <p className="muted small">{ordered.length - Object.keys(answers).length} unanswered. They count as wrong.</p>
        )}
      </section>
    );
  }

  if (step === 'saving')
    return (
      <section className="stack">
        <h1>{timedOut ? 'Time is up' : 'Marking your quiz...'}</h1>
        <p className="muted">One second, getting your score and rank.</p>
      </section>
    );

  if (step === 'gate' && station)
    return (
      <section className="stack">
        <h1>{timedOut ? 'Time is up' : 'Your answers are saved'}</h1>
        <p className="muted">They have not been handed in yet. Press the button to send them.</p>
        {error && <p className="error">{error}</p>}
        <button className="btn" disabled={busy} onClick={() => { setStep('saving'); submit(profile); }}>
          {busy ? 'Sending...' : 'Hand in my answers'}
        </button>
      </section>
    );

  if (step === 'gate')
    return (
      <div className="stack">
      {showRestore ? (
        <RestorePanel onRestored={onRestoredAtGate} onCancel={() => setShowRestore(false)} />
      ) : (
        <button type="button" className="btn ghost" onClick={() => setShowRestore(true)}>Played before? Restore my username</button>
      )}
      <form className="stack" onSubmit={onGate}>
        <h1>{timedOut ? 'Time is up' : 'Almost done'}</h1>
        <p className="muted">
          {timedOut ? 'Your answers are saved. ' : ''}You only fill this in once. We remember you on this phone, so next time you go straight to your score.
        </p>
        <label>Full name
          <input required value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} />
        </label>
        <label>Username
          <input
            placeholder="Leave blank and we will make one"
            maxLength={20}
            value={profile.username}
            onChange={(e) => setProfile({ ...profile, username: e.target.value })}
          />
          <span className="muted small">Letters, numbers and underscore only. Nobody else can use the same username.</span>
        </label>
        <label>Department
          <input required list="departments" autoComplete="off" value={profile.department} onChange={(e) => setProfile({ ...profile, department: e.target.value })} />
          <datalist id="departments">
            {deps.map((d) => <option key={d} value={d} />)}
          </datalist>
          <span className="muted small">Pick from the list if you see yours, so your department is counted together.</span>
        </label>
        <label>Level
          <select required value={profile.level} onChange={(e) => setProfile({ ...profile, level: e.target.value })}>
            <option value="">Select level</option>
            {LEVELS.map((l) => <option key={l} value={l}>{l} level</option>)}
          </select>
        </label>
        <label>WhatsApp number (optional)
          <input type="tel" inputMode="tel" placeholder="08012345678" value={profile.whatsapp} onChange={(e) => setProfile({ ...profile, whatsapp: e.target.value })} />
        </label>
        <p className="muted small">Your username, department and score appear on the public leaderboard. Your name and number stay private. We never sell your details.</p>
        {error && <p className="error">{error}</p>}
        <button className="btn" disabled={busy}>{busy ? 'Checking...' : 'See my score'}</button>
      </form>
      </div>
    );

  // result, tutor exam
  if (station) {
    if (result.hidden)
      return (
        <section className="stack">
          <h1>Thank you, {result.name}</h1>
          <p className="muted">Your answers have been handed in. Your tutor will share the results.</p>
          <button className="btn" onClick={() => window.location.reload()}>Next student</button>
          <p className="muted small">This page resets by itself in a few seconds.</p>
        </section>
      );
    const byId = Object.fromEntries(result.review.map((r) => [r.id, r]));
    return (
      <section className="stack">
        <div className="score">
          <span className="big">{result.score}/{result.total}</span>
          <span className="muted">{Math.round((result.score / result.total) * 100)}%, {result.name}</span>
        </div>
        {result.subjectScores && Object.keys(result.subjectScores).length > 1 && (
          <div className="chips">
            {Object.entries(result.subjectScores).map(([k, v]) => <span key={k} className="chip">{k}: {v[0]}/{v[1]}</span>)}
          </div>
        )}
        {result.late && <p className="card muted small">You handed in after the time was up.</p>}
        <button className="btn" onClick={() => window.location.reload()}>Next student</button>
        <h2>Top scores</h2>
        <Board rows={result.setBoard} />
        <h2>Corrections</h2>
        {ordered.map((qq, n) => {
          const r = byId[qq.id];
          const ok = r.chosen === r.correct;
          return (
            <div key={qq.id} className={`card review ${ok ? 'ok' : 'bad'}`}>
              <p className="meta">{qq.subject ? `${qq.subject}, ` : ''}Question {n + 1}: {ok ? 'Correct' : r.chosen === null ? 'Not answered' : 'Wrong'}</p>
              <p className="qtext"><Rich text={qq.text} /></p>
              {qq.image_url && <img className="qimg" src={qq.image_url} alt="" />}
              <p>Correct answer: <strong><Rich text={qq.options[r.correct]} /></strong></p>
              {!ok && r.chosen !== null && <p className="muted">You picked: <Rich text={qq.options[r.chosen]} /></p>}
              {r.explanation && <p className="small">Why: <Rich text={r.explanation} /></p>}
            </div>
          );
        })}
        <button className="btn" onClick={() => window.location.reload()}>Next student</button>
      </section>
    );
  }

  // result
  const pct = Math.round((result.score / result.total) * 100);
  const dept = (result.profile?.department || profile.department || '').trim();
  const url = typeof window !== 'undefined' ? window.location.href : '';
  const showRank = result.counted && result.setRank;
  const rankText = showRank ? ` and I am #${result.setRank.rank} on the leaderboard` : '';
  const base = `I scored ${result.score}/${result.total} on "${quiz.title}"${rankText}.`;
  const challenge = `${base} Can you beat my score? Try it free: ${url}`;
  const share = `${base} Can you beat me? Try it free: ${url}`;
  const wa = (t) => `https://wa.me/?text=${encodeURIComponent(t)}`;
  const reviewById = Object.fromEntries(result.review.map((r) => [r.id, r]));

  const prevS = result.prevSetRank;
  const nowS = result.setRank;
  let note = null;
  if (result.late) {
    note = result.lateReason === 'no-start'
      ? 'We could not confirm when you started, so this score is not ranked. Check your connection and retake.'
      : 'You submitted after the time was up, so this score is not ranked.';
  } else if (!result.isFirst) {
    if (prevS && nowS && nowS.rank < prevS.rank) note = `Your new score moved you up from #${prevS.rank} to #${nowS.rank} on this set.`;
    else if (prevS && nowS && nowS.rank > prevS.rank) note = `Your new score replaced your old one. You are now #${nowS.rank} on this set (was #${prevS.rank}).`;
    else note = 'Your new score replaced your old one on the leaderboard.';
  }

  async function shareImage() {
    setSharing(true);
    try {
      const p = new URLSearchParams({ u: result.username, s: result.score, t: result.total, q: quiz.title, d: dept });
      if (showRank) { p.set('r', result.setRank.rank); p.set('n', result.setRank.total); }
      const res = await fetch(`/api/card?${p}`);
      const blob = await res.blob();
      const file = new File([blob], 'my-score.png', { type: 'image/png' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({ files: [file], text: share });
          return;
        } catch (err) {
          if (err.name === 'AbortError') return;
        }
      }
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'my-score.png';
      a.click();
    } finally {
      setSharing(false);
    }
  }

  return (
    <section className="stack">
      <div className="score">
        <span className="big">{result.score}/{result.total}</span>
        <span className="muted">{pct}% as @{result.username}</span>
        {showRank && <span className="meta">#{result.setRank.rank} of {result.setRank.total} on this set</span>}
        {result.counted && result.courseRank && <span className="meta">#{result.courseRank.rank} of {result.courseRank.total} in {quiz.course}</span>}
      </div>
      {note && <p className="card muted small">{note}</p>}
      {!pinSet && <PinCard onSaved={onPinSaved} />}
      {pinFlash && <p className="card small">{pinFlash}</p>}

      <button className="btn" onClick={shareImage} disabled={sharing}>{sharing ? 'Making your card...' : 'Share my score card'}</button>
      <a className="btn wa" target="_blank" rel="noreferrer" href={wa(challenge)}>
        {dept ? `Challenge My Score` : 'Challenge my department Score'}
      </a>

      <h2>Top scores in this set</h2>
      <Board rows={result.setBoard} me={result.username} />

      {quiz.course && (
        <>
          <h2>Top overall in {quiz.course}</h2>
          <Board rows={result.courseBoard} me={result.username} overall />
          <Link href={courseHref}>See the full {quiz.course} leaderboard and department ranking</Link>
        </>
      )}

      {collection && (
        <Link href={`/c/${collection.code}`}>See the {collection.title} leaderboard and the other sets</Link>
      )}

      <h2>Corrections</h2>
      {ordered.map((qq, n) => {
        const r = reviewById[qq.id];
        const ok = r.chosen === r.correct;
        return (
          <div key={qq.id} className={`card review ${ok ? 'ok' : 'bad'}`}>
            <p className="meta">Question {n + 1}: {ok ? 'Correct' : r.chosen === null ? 'Not answered' : 'Wrong'}</p>
            <p className="qtext"><Rich text={qq.text} /></p>
            {qq.image_url && <img className="qimg" src={qq.image_url} alt="" />}
            <p>Correct answer: <strong><Rich text={qq.options[r.correct]} /></strong></p>
            {!ok && r.chosen !== null && <p className="muted">You picked: <Rich text={qq.options[r.chosen]} /></p>}
            {r.explanation && <p className="small">Why: <Rich text={r.explanation} /></p>}
          </div>
        );
      })}
      <Link className="btn ghost" href="/practice">Try another set</Link>
      <button className="btn ghost" onClick={switchAccount}>Not @{result.username}? Use a different name</button>
    </section>
  );
}