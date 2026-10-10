'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Board from './Board';
import Rich from './Rich';
import Calculator from './Calculator';
import { PARTNER } from '../lib/brand';

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
  return { qs: shuffle(questions.map((q) => q.id)), opts };
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
   const creatorUrl = process.env.NEXT_PUBLIC_CREATOR_GROUP_URL || "";


  const limit = (quiz.time_limit_minutes || 0) * 60;
  const startRef = useRef(0);
  const booted = useRef(false);
  const answersRef = useRef({});
  const tokenRef = useRef('');
  answersRef.current = answers;
  tokenRef.current = token;
  const [left, setLeft] = useState(limit);

  const stateKey = `quizState:${quiz.id}`;
  const byId = Object.fromEntries(questions.map((qq) => [qq.id, qq]));
  const ordered = plan ? plan.qs.map((id) => byId[id]) : questions;
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
          clientId: getClientId(),
          token: tokenRef.current,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Something went wrong');
      const saved = { ...data.profile, whatsapp: p.whatsapp || '' };
      try {
        localStorage.setItem('profile', JSON.stringify(saved));
        localStorage.removeItem(stateKey);
      } catch {}
      setProfile((prev) => ({ ...prev, ...saved }));
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
    const p = savedProfile();
    if (p) setProfile((prev) => ({ ...prev, ...p }));
    setPinSet(pinIsSet());
    try {
      const s = JSON.parse(localStorage.getItem(stateKey) || 'null');
      if (!s || !s.plan || !s.token) return;
      const age = (Date.now() - s.startedAt) / 1000;
      const planOk =
        s.plan.qs.length === questions.length &&
        s.plan.qs.every((id) => byId[id]) &&
        Object.entries(s.plan.opts).every(([id, o]) => byId[id] && byId[id].options.length === o.length);
      if (!planOk || age > SIX_HOURS) {
        localStorage.removeItem(stateKey);
        return;
      }
      startRef.current = s.startedAt;
      answersRef.current = s.answers || {};
      tokenRef.current = s.token;
      setPlan(s.plan);
      setToken(s.token);
      setAnswers(s.answers || {});
      setI(Math.min(s.i || 0, questions.length - 1));
      if (s.phase === 'gate') {
        goToScore(Boolean(s.timedOut));
      } else if (limit && age >= limit) {
        goToScore(true);
      } else {
        setLeft(limit ? Math.max(0, limit - Math.floor(age)) : 0);
        setStep('quiz');
      }
    } catch {}
  }, []);

  // Save progress after every answer so a refresh or a dropped connection costs nothing.
  useEffect(() => {
    if (step !== 'quiz' && step !== 'gate' && step !== 'saving') return;
    try {
      localStorage.setItem(stateKey, JSON.stringify({
        phase: step === 'quiz' ? 'quiz' : 'gate',
        startedAt: startRef.current, token, plan, answers, i, timedOut,
      }));
    } catch {}
  }, [step, answers, i, token, plan, timedOut]);

  // Department suggestions are only needed when the first-time form is on screen.
  useEffect(() => {
    if (step !== 'gate' || deps.length) return;
    fetch('/api/departments')
      .then((r) => r.json())
      .then((d) => setDeps(d.departments || []))
      .catch(() => {});
  }, [step]);

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
    tokenRef.current = '';
    answersRef.current = {};
    setPlan(makePlan(questions));
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

  if (!questions.length) return <p className="muted">This quiz has no questions yet.</p>;

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
    return (
      <section className="stack">
        <div className="row between">
          <p className="meta">Question {i + 1} of {ordered.length}</p>
          <div className="row">
            {quiz.allow_calculator && (
              <button type="button" className="btn sm ghost" aria-expanded={calcOpen} onClick={() => setCalcOpen((o) => !o)}>
                {calcOpen ? 'Hide calculator' : 'Calculator'}
              </button>
            )}
            {limit > 0 && <span className={`timer ${left <= 60 ? 'low' : ''}`}>{mmss(left)}</span>}
          </div>
        </div>
        <div className="progress"><div style={{ width: `${((i + 1) / ordered.length) * 100}%` }} /></div>
        {quiz.allow_calculator && (
          <div style={{ display: calcOpen ? 'block' : 'none' }}>
            <Calculator />
          </div>
        )}
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
          {last ? (
            <button className="btn" onClick={() => goToScore(false)}>Submit and see my score</button>
          ) : (
            <button className="btn" onClick={() => setI(i + 1)}>Next</button>
          )}
        </div>
        {last && Object.keys(answers).length < ordered.length && (
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
      <Link className="btn ghost" href="/">Try another set</Link>
      <button className="btn ghost" onClick={switchAccount}>Not @{result.username}? Use a different name</button>
    </section>
  );
}