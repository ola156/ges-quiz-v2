'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Rich from './Rich';

const LETTERS = ['A', 'B', 'C', 'D', 'E'];

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Picks `count` questions at random, in random order, and shuffles each question's options.
// Answers are always sent as the original option number.
function makePlan(questions, count) {
  const order = shuffle(questions.map((q) => q.i)).slice(0, count);
  return { order, opts: Object.fromEntries(questions.map((q) => [q.i, shuffle(q.o.map((_, k) => k))])) };
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
.sq-time { margin-left: auto; font-variant-numeric: tabular-nums; }
`;

async function post(body) {
  const res = await fetch('/api/study', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Something went wrong. Try again.');
  return data;
}

const TIMES = [['none', 'No timer'], ['10', '10 minutes'], ['20', '20 minutes'], ['30', '30 minutes'], ['custom', 'Choose my own']];
const clock = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

// How many questions a student can choose to take.
function countChoices(total) {
  const c = [5, 10, 20].filter((n) => n < total);
  return [...c, total];
}

export default function StudyRunner({ subtopicId, cards, questions, initial, backHref, next }) {
  const total = questions.length;
  const [step, setStep] = useState('cards'); // cards | setup | quiz | result
  const [c, setC] = useState(0);
  const [qmode, setQmode] = useState('study'); // study: answer shown after each question. exam: answers shown at the end.
  const [count, setCount] = useState(total);
  const [plan, setPlan] = useState(() => makePlan(questions, total));
  const [qi, setQi] = useState(0);
  const [answers, setAnswers] = useState({}); // question number -> chosen original option
  const [checked, setChecked] = useState({}); // study mode: question number -> { correct, answer, why }
  const [result, setResult] = useState(null);
  const [timeSel, setTimeSel] = useState('none');
  const [custom, setCustom] = useState('');
  const [left, setLeft] = useState(null); // seconds left, exam mode with a timer
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const keyRef = useRef(null);
  const submitRef = useRef(() => {});
  const answersRef = useRef({});
  const deadline = useRef(0);
  const answerKey = useRef(null); // study mode: [{ a, why }], loaded once, so answers show at once
  const keyLoad = useRef(null);
  const sending = useRef(false);

  useEffect(() => {
    const onKey = (e) => keyRef.current && keyRef.current(e);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  keyRef.current = null;
  answersRef.current = answers;
  submitRef.current = submit;

  // The answers are fetched once, in the background, as soon as study mode is possible.
  // After that every answer is checked in the browser with no waiting.
  function loadKey() {
    if (answerKey.current) return Promise.resolve(answerKey.current);
    if (!keyLoad.current) {
      keyLoad.current = post({ action: 'key', subtopicId })
        .then((r) => { answerKey.current = r.key; return r.key; })
        .catch((e) => { keyLoad.current = null; throw e; });
    }
    return keyLoad.current;
  }

  const byI = Object.fromEntries(questions.map((q) => [q.i, q]));
  const need = Math.min(10, Math.ceil(total / 2));
  const top = () => window.scrollTo({ top: 0 });

  function openSetup() {
    if (qmode === 'study') loadKey().catch(() => {});
    setStep('setup');
    setError('');
    top();
  }

  async function finishCards() {
    setBusy(true);
    setError('');
    try {
      await post({ action: 'cards', subtopicId });
      openSetup();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  function chooseMode(m) {
    setQmode(m);
    if (m === 'study') loadKey().catch(() => {});
  }

  async function startQuiz() {
    setError('');
    const minutes = timeSel === 'custom' ? Math.round(Number(custom)) : timeSel === 'none' ? 0 : Number(timeSel);
    if (qmode === 'exam' && timeSel === 'custom' && !(minutes >= 1 && minutes <= 300)) {
      setError('Type a time between 1 and 300 minutes.');
      return;
    }
    if (qmode === 'study' && !answerKey.current) {
      setBusy(true);
      try { await loadKey(); } catch (e) { setError(e.message); setBusy(false); return; }
      setBusy(false);
    }
    setPlan(makePlan(questions, count));
    setQi(0);
    setAnswers({});
    setChecked({});
    setResult(null);
    sending.current = false;
    if (qmode === 'exam' && minutes > 0) {
      deadline.current = Date.now() + minutes * 60000;
      setLeft(minutes * 60);
    } else {
      deadline.current = 0;
      setLeft(null);
    }
    setStep('quiz');
    top();
  }

  function pick(n, choice) {
    if (sending.current) return;
    if (qmode === 'exam') {
      setAnswers((a) => ({ ...a, [n]: choice }));
      return;
    }
    if (checked[n]) return;
    const k = answerKey.current?.[n];
    if (!k) return;
    setAnswers((a) => ({ ...a, [n]: choice }));
    setChecked((x) => ({ ...x, [n]: { correct: choice === k.a, answer: k.a, why: k.why } }));
  }

  // Hands the quiz in. Study mode shows the score straight away and saves in the background.
  // Exam mode waits for the server, because the answers are only revealed after hand-in.
  async function submit() {
    if (sending.current) return;
    sending.current = true;
    setError('');
    const have = answersRef.current;
    const sent = Object.fromEntries(plan.order.map((i) => [i, Number.isInteger(have[i]) ? have[i] : null]));
    const key = answerKey.current;
    if (qmode === 'study' && key) {
      const review = plan.order.map((i) => ({ i, correct: key[i].a, chosen: sent[i], why: key[i].why }));
      const score = review.filter((r) => r.chosen === r.correct).length;
      const counts = review.filter((r) => r.chosen !== null).length >= need;
      setResult({ score, total: review.length, review, counts, need, passed: counts && score / review.length >= 0.6 });
      setStep('result');
      top();
      post({ action: 'submit', subtopicId, answers: sent }).catch(() => setError('Your score could not be saved. Check your connection and try the quiz again.'));
      return;
    }
    setBusy(true);
    try {
      const r = await post({ action: 'submit', subtopicId, answers: sent });
      setResult(r);
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
    if (qi < plan.order.length - 1) {
      setQi(qi + 1);
      setError('');
      return;
    }
    submit();
  }

  // The countdown uses the clock time it must end at, so a sleeping phone cannot cheat it.
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

  // ---- study cards ----
  if (step === 'cards') {
    const card = cards[c];
    const lastCard = c === cards.length - 1;
    keyRef.current = (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
      const k = String(e.key).toLowerCase();
      if (k === 'n' && !lastCard) setC(c + 1);
      else if (k === 'p' && c > 0) setC(c - 1);
    };
    return (
      <section className="stack">
        <div className="card stack tight">
          <span className="muted small">{c + 1} of {cards.length}</span>
          <h2 className="card-h"><Rich text={card.t} /></h2>
          <ul style={{ margin: 0, paddingLeft: 20, display: 'grid', gap: 10, color: 'var(--ink)', lineHeight: 1.55 }}>
            {card.p.map((line, i) => <li key={i}><Rich text={line} /></li>)}
          </ul>
        </div>
        {lastCard ? (
          total ? (
            <button type="button" className="btn" disabled={busy} onClick={finishCards}>{busy ? 'Saving...' : 'Take quiz'}</button>
          ) : (
            <Link href={backHref} className="btn">Finish</Link>
          )
        ) : (
          <button type="button" className="btn" onClick={() => setC(c + 1)}>Next</button>
        )}
        <div className="row between">
          <button type="button" className="slink" disabled={c === 0} onClick={() => setC(c - 1)}>Previous</button>
          {total > 0 && !lastCard && initial.cardsDone && <button type="button" className="slink" onClick={openSetup}>Skip to quiz</button>}
        </div>
        {error && <p className="error">{error}</p>}
      </section>
    );
  }

  // ---- quiz setup ----
  if (step === 'setup') {
    const choices = countChoices(total);
    return (
      <section className="stack">
        <h2>Quiz setup</h2>
        {initial.total ? <p className="sbar-note">Best so far: {initial.best}/{initial.total}</p> : null}

        <p className="sgroup">Mode</p>
        <div className="slist" role="radiogroup" aria-label="Mode">
          <div role="radio" aria-checked={qmode === 'study'} tabIndex={0} className={`srow ${qmode === 'study' ? 'sel' : ''}`} onClick={() => chooseMode('study')} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && chooseMode('study')}>
            <span className="dot" />
            <span className="t">Study mode<small>See the right answer and why after each question.</small></span>
          </div>
          <div role="radio" aria-checked={qmode === 'exam'} tabIndex={0} className={`srow ${qmode === 'exam' ? 'sel' : ''}`} onClick={() => setQmode('exam')} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setQmode('exam')}>
            <span className="dot" />
            <span className="t">Exam mode<small>Answer everything first. Corrections come at the end.</small></span>
          </div>
        </div>

        {choices.length > 1 && (
          <>
            <p className="sgroup">Questions</p>
            <div className="slist" role="radiogroup" aria-label="Number of questions">
              {choices.map((n) => (
                <div key={n} role="radio" aria-checked={count === n} tabIndex={0} className={`srow ${count === n ? 'sel' : ''}`} onClick={() => setCount(n)} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setCount(n)}>
                  <span className="dot" />
                  <span className="t">{n === total ? `All ${n}` : n}</span>
                </div>
              ))}
            </div>
            <p className="sbar-note">To count towards this lesson, answer at least {need} questions.</p>
          </>
        )}

        {qmode === 'exam' && (
          <>
            <p className="sgroup">Timer</p>
            <div className="slist" role="radiogroup" aria-label="Timer">
              {TIMES.map(([id, label]) => (
                <div key={id} role="radio" aria-checked={timeSel === id} tabIndex={0} className={`srow ${timeSel === id ? 'sel' : ''}`} onClick={() => setTimeSel(id)} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setTimeSel(id)}>
                  <span className="dot" />
                  <span className="t">{label}</span>
                </div>
              ))}
            </div>
            {timeSel === 'custom' && (
              <label>Minutes
                <input type="number" inputMode="numeric" min="1" max="300" value={custom} onChange={(e) => setCustom(e.target.value)} style={{ maxWidth: 160 }} autoFocus />
              </label>
            )}
            <p className="sbar-note">When time is up, the quiz is handed in with what you have answered.</p>
          </>
        )}
        {error && <p className="error">{error}</p>}

        <button type="button" className="btn" disabled={busy} onClick={startQuiz}>{busy ? 'Getting ready...' : 'Start quiz'}</button>
        <button type="button" className="slink" style={{ justifySelf: 'start' }} onClick={() => { setStep('cards'); setC(0); top(); }}>Read the cards again</button>
      </section>
    );
  }

  // ---- result ----
  if (step === 'result' && result) {
    const pct = Math.round((result.score / result.total) * 100);
    const wrong = result.review.filter((r) => r.chosen !== r.correct);
    const goNext = result.passed && next;
    return (
      <section className="stack">
        <div className="score">
          <span className="big">{result.score}/{result.total}</span>
          <span className="muted">{pct}%</span>
        </div>
        <p className="card">
          {!result.counts
            ? `This one does not count yet. Answer at least ${result.need} questions so a few easy ones cannot tick it off.`
            : result.passed
              ? 'Well done. This lesson counts as done once you have read the cards, and you have.'
              : 'Below 60%, so this lesson is not done yet. Read the cards again and retry. Your best score is kept.'}
        </p>
        {goNext ? <Link href={next.href} className="btn">Next: <Rich text={next.title} /></Link> : <button type="button" className="btn" onClick={openSetup}>Try again</button>}
        <div className="slist">
          {goNext && (
            <div className="srow go" role="button" tabIndex={0} onClick={openSetup} onKeyDown={(e) => e.key === 'Enter' && openSetup()}><span className="t">Try again</span></div>
          )}
          <div className="srow go" role="button" tabIndex={0} onClick={() => { setStep('cards'); setC(0); top(); }} onKeyDown={(e) => e.key === 'Enter' && (setStep('cards'), setC(0), top())}><span className="t">Read the cards again</span></div>
          <Link href={backHref} className="srow go"><span className="t">Back to lessons</span></Link>
        </div>

        {wrong.length > 0 && <h2>What to review</h2>}
        {wrong.map((r) => {
          const q = byI[r.i];
          return (
            <div key={r.i} className="card review bad stack tight">
              <p className="qtext"><Rich text={q.q} /></p>
              <p>Correct answer: <strong><Rich text={q.o[r.correct]} /></strong></p>
              {r.chosen !== null ? <p className="muted">You picked: <Rich text={q.o[r.chosen]} /></p> : <p className="muted">Not answered.</p>}
              <p className="small">Why: <Rich text={r.why} /></p>
            </div>
          );
        })}
      </section>
    );
  }

  // ---- quiz ----
  const asked = plan.order.length;
  const n = plan.order[qi];
  const q = byI[n];
  const done = checked[n];
  const exam = qmode === 'exam';
  const last = qi === asked - 1;
  const canGo = exam ? true : Boolean(done);
  keyRef.current = (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
    const k = String(e.key).toLowerCase();
    const pos = k.length === 1 ? 'abcde'.indexOf(k) : -1;
    if (pos >= 0 && pos < plan.opts[n].length) pick(n, plan.opts[n][pos]);
    else if ((k === 'n' || k === 'enter') && canGo && !busy) advance();
    else if (k === 'p' && qi > 0 && (exam || checked[plan.order[qi - 1]])) setQi(qi - 1);
  };

  return (
    <section className="stack">
      <style>{CSS}</style>
      <div className="row between">
        <p className="meta">Question {qi + 1} of {asked}</p>
        {left !== null && <span className={`timer ${left <= 60 ? 'low' : ''}`} role="timer">{clock(left)}</span>}
        {left === null && <span className="muted small">{exam ? 'Exam mode' : 'Study mode'}</span>}
      </div>
      <h2 className="qtext"><Rich text={q.q} /></h2>
      <div className="stack tight">
        {plan.opts[n].map((orig, pos) => {
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
          <p className="small"><Rich text={done.why} /></p>
        </div>
      )}
      {error && <p className="error">{error}</p>}
      <button type="button" className="btn" disabled={!canGo || busy} onClick={advance}>
        {busy ? 'Please wait...' : last ? 'See my score' : 'Next question'}
      </button>
      {exam && <button type="button" className="slink" style={{ justifySelf: 'start' }} disabled={qi === 0} onClick={() => setQi(qi - 1)}>Previous</button>}

      <div className="sq-nums" role="group" aria-label="Question numbers">
        {plan.order.map((qn, idx) => {
          const c = checked[qn];
          const has = Number.isInteger(answers[qn]);
          const state = exam ? (has ? 'pick' : '') : c ? (c.correct ? 'done' : 'no') : '';
          const clickable = exam || Boolean(c);
          return (
            <button
              key={qn}
              type="button"
              className={`sq-n ${state} ${idx === qi ? 'cur' : ''} ${clickable ? 'go' : ''}`}
              onClick={() => clickable && setQi(idx)}
              aria-label={`Question ${idx + 1}${idx === qi ? ', now' : has ? ', answered' : ', not answered'}`}
              aria-current={idx === qi ? 'step' : undefined}
            >
              {idx + 1}
            </button>
          );
        })}
      </div>
      <div className="sq-key">
        <span><i className="d" />Answered</span>
        <span><i className="c" />Now</span>
        <span><i />To do</span>
      </div>
    </section>
  );
}