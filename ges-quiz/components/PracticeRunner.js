'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Rich from './Rich';

const LETTERS = ['A', 'B', 'C', 'D', 'E'];
const MAX = 100;
const clock = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const CSS = `
.sq-nums { display: grid; grid-template-columns: repeat(auto-fill, minmax(42px, 1fr)); gap: 6px; }
.sq-n { height: 40px; border: 1.5px solid var(--surface-line); border-radius: 10px; background: transparent; color: var(--ink); font: inherit; font-weight: 600; font-variant-numeric: tabular-nums; cursor: default; }
.sq-n.go { cursor: pointer; }
.sq-n.done { border-color: var(--ok); background: rgba(52, 211, 153, 0.16); }
.sq-n.pick { border-color: var(--link); background: rgba(79, 70, 229, 0.14); }
.sq-n.no { border-color: var(--bad); background: rgba(248, 113, 113, 0.16); }
.sq-n.cur { border: 2.5px solid var(--link); box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.18); }
.sq-key { display: flex; flex-wrap: wrap; gap: 14px; font-size: 0.8rem; color: var(--on-dark-muted); }
.sq-key i { display: inline-block; width: 12px; height: 12px; margin-right: 6px; border-radius: 4px; border: 1.5px solid var(--surface-line); vertical-align: -1px; }
.sq-key .d { border-color: var(--ok); background: rgba(52, 211, 153, 0.3); }
.sq-key .c { border: 2.5px solid var(--link); }
.opt.sq { color: var(--ink); opacity: 1; }
.opt.sq * { color: inherit; }
.opt.sq .letter { color: var(--blue-dark); }
.opt.sq.picked .letter { color: #fff; }
.pr-img { max-width: 100%; max-height: 260px; border-radius: 10px; }
`;

async function post(body) {
  const res = await fetch('/api/practice', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Something went wrong. Try again.');
  return data;
}

function Choice({ on, onPick, children }) {
  return (
    <div role="radio" aria-checked={on} tabIndex={0} className={`srow ${on ? 'sel' : ''}`} onClick={onPick} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onPick()}>
      <span className="dot" />
      <span className="t">{children}</span>
    </div>
  );
}

export default function PracticeRunner({ subjects, start, userName }) {
  const first = subjects.find((s) => s.key === start) || subjects[0];
  const [step, setStep] = useState('setup'); // setup | quiz | result
  const [subject, setSubject] = useState(first?.key || '');
  const [mode, setMode] = useState('study'); // study: answer after each question. exam: answers at the end.
  const [preset, setPreset] = useState('20');
  const [custom, setCustom] = useState('');
  const [timeSel, setTimeSel] = useState('none');
  const [customTime, setCustomTime] = useState('');
  const [run, setRun] = useState(null); // { token, subject, questions, key, opts }
  const [qi, setQi] = useState(0);
  const [answers, setAnswers] = useState({});
  const [checked, setChecked] = useState({});
  const [result, setResult] = useState(null);
  const [left, setLeft] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sharing, setSharing] = useState(false);
  const keyRef = useRef(null);
  const sending = useRef(false);
  const deadline = useRef(0);
  const answersRef = useRef({});
  const submitRef = useRef(() => {});
  const runRef = useRef(null);
  answersRef.current = answers;
  runRef.current = run;
  submitRef.current = submit;

  useEffect(() => {
    const onKey = (e) => keyRef.current && keyRef.current(e);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  keyRef.current = null;

  const sel = subjects.find((s) => s.key === subject);
  const cap = Math.min(MAX, sel?.count || 0);
  const top = () => window.scrollTo({ top: 0 });

  const presets = [10, 20, 40, 60].filter((n) => n < cap);
  const wanted = preset === 'custom' ? Math.round(Number(custom)) : preset === 'all' ? cap : Number(preset);
  const count = Math.min(cap, wanted);

  async function begin() {
    setError('');
    if (!sel) return setError('Pick a subject.');
    if (!(wanted >= 1)) return setError(`Type a number of questions from 1 to ${cap}.`);
    let minutes = 0;
    if (mode === 'exam') {
      if (timeSel === 'auto') minutes = Math.max(1, count);
      else if (timeSel === 'custom') {
        minutes = Math.round(Number(customTime));
        if (!(minutes >= 1 && minutes <= 300)) return setError('Type a time between 1 and 300 minutes.');
      }
    }
    setBusy(true);
    try {
      const r = await post({ action: 'start', subject, count, mode });
      const opts = Object.fromEntries(r.questions.map((q) => [q.i, shuffle(q.o.map((_, k) => k))]));
      setRun({ ...r, opts });
      setQi(0);
      setAnswers({});
      setChecked({});
      setResult(null);
      sending.current = false;
      if (minutes > 0) {
        deadline.current = Date.now() + minutes * 60000;
        setLeft(minutes * 60);
      } else {
        deadline.current = 0;
        setLeft(null);
      }
      setStep('quiz');
      top();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  function pick(n, choice) {
    if (sending.current || !run) return;
    if (mode === 'exam') {
      setAnswers((a) => ({ ...a, [n]: choice }));
      return;
    }
    if (checked[n]) return;
    const k = run.key?.[n];
    if (!k) return;
    setAnswers((a) => ({ ...a, [n]: choice }));
    setChecked((x) => ({ ...x, [n]: { correct: choice === k.a, answer: k.a, why: k.why } }));
  }

  // Study mode shows the score at once and saves in the background. Exam mode waits for the server,
  // because the corrections are only revealed after hand-in.
  async function submit() {
    const r = runRef.current;
    if (sending.current || !r) return;
    sending.current = true;
    setError('');
    const have = answersRef.current;
    const sent = Object.fromEntries(r.questions.map((q) => [q.i, Number.isInteger(have[q.i]) ? have[q.i] : null]));
    if (mode === 'study' && r.key) {
      const review = r.questions.map((q) => ({ i: q.i, correct: r.key[q.i].a, chosen: sent[q.i], why: r.key[q.i].why }));
      const score = review.filter((x) => x.chosen === x.correct).length;
      setResult({ score, total: review.length, review, subject: r.subject, name: userName });
      setStep('result');
      top();
      post({ action: 'submit', token: r.token, answers: sent }).catch(() => setError('Your score could not be saved. Check your connection.'));
      return;
    }
    setBusy(true);
    try {
      const res = await post({ action: 'submit', token: r.token, answers: sent });
      setResult(res);
      setStep('result');
      top();
    } catch (e) {
      sending.current = false;
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  function advance() {
    if (qi < run.questions.length - 1) {
      setQi(qi + 1);
      setError('');
      return;
    }
    submit();
  }

  useEffect(() => {
    if (step !== 'quiz' || !deadline.current) return undefined;
    const tick = () => {
      const s = Math.max(0, Math.ceil((deadline.current - Date.now()) / 1000));
      setLeft(s);
      if (s === 0) submitRef.current();
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [step]);

  // ---- setup ----
  if (step === 'setup') {
    if (!subjects.length) {
      return <p className="muted">No questions are ready for your exam yet. Check back soon.</p>;
    }
    return (
      <section className="stack">
        <p className="sgroup">Subject</p>
        <div className="slist" role="radiogroup" aria-label="Subject">
          {subjects.map((s) => (
            <Choice key={s.key} on={subject === s.key} onPick={() => { setSubject(s.key); setError(''); }}>
              <Rich text={s.name} /><small>{s.count} question{s.count === 1 ? '' : 's'} available</small>
            </Choice>
          ))}
        </div>

        <p className="sgroup">Mode</p>
        <div className="slist" role="radiogroup" aria-label="Mode">
          <Choice on={mode === 'study'} onPick={() => setMode('study')}>Study mode<small>See the right answer and why after each question.</small></Choice>
          <Choice on={mode === 'exam'} onPick={() => setMode('exam')}>Exam mode<small>Answer everything first. Corrections come at the end.</small></Choice>
        </div>

        <p className="sgroup">Number of questions</p>
        <div className="slist" role="radiogroup" aria-label="Number of questions">
          {presets.map((n) => <Choice key={n} on={preset === String(n)} onPick={() => setPreset(String(n))}>{n}</Choice>)}
          <Choice on={preset === 'all'} onPick={() => setPreset('all')}>{cap < (sel?.count || 0) ? `${cap} (the most in one go)` : `All ${cap}`}</Choice>
          <Choice on={preset === 'custom'} onPick={() => setPreset('custom')}>Choose my own</Choice>
        </div>
        {preset === 'custom' && (
          <label>How many (1 to {cap})
            <input type="number" inputMode="numeric" min="1" max={cap} value={custom} onChange={(e) => setCustom(e.target.value)} style={{ maxWidth: 160 }} autoFocus />
          </label>
        )}

        {mode === 'exam' && (
          <>
            <p className="sgroup">Timer</p>
            <div className="slist" role="radiogroup" aria-label="Timer">
              <Choice on={timeSel === 'none'} onPick={() => setTimeSel('none')}>No timer</Choice>
              <Choice on={timeSel === 'auto'} onPick={() => setTimeSel('auto')}>1 minute per question<small>{count >= 1 ? `${count} minute${count === 1 ? '' : 's'} for ${count} question${count === 1 ? '' : 's'}` : ''}</small></Choice>
              <Choice on={timeSel === 'custom'} onPick={() => setTimeSel('custom')}>Choose my own</Choice>
            </div>
            {timeSel === 'custom' && (
              <label>Minutes
                <input type="number" inputMode="numeric" min="1" max="300" value={customTime} onChange={(e) => setCustomTime(e.target.value)} style={{ maxWidth: 160 }} />
              </label>
            )}
            <p className="sbar-note">When time is up, your practice is handed in with what you have answered.</p>
          </>
        )}

        <p className="sbar-note">Every practice counts on the leaderboard, whatever the number of questions.</p>
        {error && <p className="error">{error}</p>}
        <button type="button" className="btn" disabled={busy} onClick={begin}>{busy ? 'Getting your questions...' : 'Start practice'}</button>
        <Link href={`/practice/leaderboard?subject=${encodeURIComponent(subject)}`} className="slink" style={{ justifySelf: 'start' }}>See the leaderboard</Link>
      </section>
    );
  }

  const byI = run ? Object.fromEntries(run.questions.map((q) => [q.i, q])) : {};

  // ---- result ----
  if (step === 'result' && result) {
    const pct = Math.round((result.score / result.total) * 100);
    const wrong = result.review.filter((r) => r.chosen !== r.correct);
    const text = `I scored ${result.score}/${result.total} (${pct}%) in ${result.subject} practice on Instrict Quizmate. Can you beat me? Try it free: ${typeof window !== 'undefined' ? window.location.origin : ''}`;
    const shareImage = async () => {
      setSharing(true);
      try {
        const p = new URLSearchParams({ u: result.name || 'student', s: result.score, t: result.total, q: `${result.subject} practice`, d: '' });
        const res = await fetch(`/api/card?${p}`);
        const blob = await res.blob();
        const file = new File([blob], 'my-score.png', { type: 'image/png' });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          try { await navigator.share({ files: [file], text }); return; } catch (err) { if (err.name === 'AbortError') return; }
        }
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'my-score.png';
        a.click();
      } finally {
        setSharing(false);
      }
    };
    return (
      <section className="stack">
        <div className="score">
          <span className="big">{result.score}/{result.total}</span>
          <span className="muted">{pct}%{result.name ? ` as ${result.name}` : ''}</span>
        </div>
        <button type="button" className="btn" disabled={sharing} onClick={shareImage}>{sharing ? 'Making your card...' : 'Share my score'}</button>
        <a className="btn wa" target="_blank" rel="noreferrer" href={`https://wa.me/?text=${encodeURIComponent(text)}`}>Challenge friends on WhatsApp</a>
        {error && <p className="error">{error}</p>}
        <div className="slist">
          <div className="srow go" role="button" tabIndex={0} onClick={() => { setStep('setup'); top(); }} onKeyDown={(e) => e.key === 'Enter' && setStep('setup')}><span className="t">Practise again</span></div>
          <Link href={`/practice/leaderboard?subject=${encodeURIComponent(subject)}`} className="srow go"><span className="t">See the leaderboard</span></Link>
        </div>

        {wrong.length > 0 && <h2>What to review</h2>}
        {wrong.map((r) => {
          const q = byI[r.i];
          return (
            <div key={r.i} className="card review bad stack tight">
              <p className="qtext"><Rich text={q.q} /></p>
              <p>Correct answer: <strong><Rich text={q.o[r.correct]} /></strong></p>
              {r.chosen !== null ? <p className="muted">You picked: <Rich text={q.o[r.chosen]} /></p> : <p className="muted">Not answered.</p>}
              {r.why ? <p className="small">Why: <Rich text={r.why} /></p> : null}
            </div>
          );
        })}
      </section>
    );
  }

  // ---- quiz ----
  if (!run) return null;
  const asked = run.questions.length;
  const q = run.questions[qi];
  const n = q.i;
  const done = checked[n];
  const exam = mode === 'exam';
  const last = qi === asked - 1;
  const canGo = exam ? true : Boolean(done);
  keyRef.current = (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
    const k = String(e.key).toLowerCase();
    const pos = k.length === 1 ? 'abcde'.indexOf(k) : -1;
    if (pos >= 0 && pos < run.opts[n].length) pick(n, run.opts[n][pos]);
    else if ((k === 'n' || k === 'enter') && canGo && !busy) advance();
    else if (k === 'p' && qi > 0 && (exam || checked[run.questions[qi - 1].i])) setQi(qi - 1);
  };

  return (
    <section className="stack">
      <style>{CSS}</style>
      <div className="row between">
        <p className="meta">{run.subject}: question {qi + 1} of {asked}</p>
        {left !== null ? <span className={`timer ${left <= 60 ? 'low' : ''}`} role="timer">{clock(left)}</span> : <span className="muted small">{exam ? 'Exam mode' : 'Study mode'}</span>}
      </div>
      <h2 className="qtext"><Rich text={q.q} /></h2>
      {q.img && <img className="pr-img" src={q.img} alt="" />}
      <div className="stack tight">
        {run.opts[n].map((orig, pos) => {
          const isRight = !exam && done && done.answer === orig;
          const isWrong = !exam && done && answers[n] === orig && !done.correct;
          const picked = exam && answers[n] === orig;
          return (
            <button
              key={orig}
              type="button"
              className={`opt sq ${picked ? 'picked' : ''}`}
              onClick={() => pick(n, orig)}
              aria-pressed={picked || undefined}
              style={isRight ? { borderColor: 'var(--ok)', background: 'rgba(52, 211, 153, 0.18)', cursor: 'default' } : isWrong ? { borderColor: 'var(--bad)', background: 'rgba(248, 113, 113, 0.18)', cursor: 'default' } : !exam && done ? { cursor: 'default' } : undefined}
            >
              <span className="letter">{LETTERS[pos]}</span>
              <span><Rich text={q.o[orig]} /></span>
            </button>
          );
        })}
      </div>
      {!exam && done && (
        <div className={`card review ${done.correct ? 'ok' : 'bad'} stack tight`}>
          <strong>{done.correct ? 'Correct' : 'Not quite'}</strong>
          <p className="small">The right answer is <strong><Rich text={q.o[done.answer]} /></strong>.</p>
          {done.why ? <p className="small"><Rich text={done.why} /></p> : null}
        </div>
      )}
      {error && <p className="error">{error}</p>}
      <button type="button" className="btn" disabled={!canGo || busy} onClick={advance}>
        {busy ? 'Please wait...' : last ? 'See my score' : 'Next question'}
      </button>
      {exam && <button type="button" className="slink" style={{ justifySelf: 'start' }} disabled={qi === 0} onClick={() => setQi(qi - 1)}>Previous</button>}

      <div className="sq-nums" role="group" aria-label="Question numbers">
        {run.questions.map((x, idx) => {
          const c = checked[x.i];
          const has = Number.isInteger(answers[x.i]);
          const state = exam ? (has ? 'pick' : '') : c ? (c.correct ? 'done' : 'no') : '';
          const clickable = exam || Boolean(c);
          return (
            <button
              key={x.i}
              type="button"
              className={`sq-n ${state} ${idx === qi ? 'cur' : ''} ${clickable ? 'go' : ''}`}
              onClick={() => clickable && setQi(idx)}
              aria-label={`Question ${idx + 1}`}
              aria-current={idx === qi ? 'step' : undefined}
            >{idx + 1}</button>
          );
        })}
      </div>
      <div className="sq-key"><span><i className="d" />{exam ? 'Answered' : 'Done'}</span><span><i className="c" />Now</span><span><i />To do</span></div>
    </section>
  );
}