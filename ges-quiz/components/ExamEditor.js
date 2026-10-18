'use client';
import { memo, useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { parseQuestions, AI_PROMPT } from '../lib/parse';
import { examState, lagos } from '../lib/exam';
import Rich from './Rich';
import { schoolName } from '../lib/schools';

const TRACK_NAMES = { jamb: 'JAMB', waec: 'WAEC', post_utme: 'Post-UTME', university: 'University' };
const NEEDS_SCHOOL = ['post_utme', 'university'];

// Added to the AI prompt so maths comes back in a form that shows properly to students.
const MATH_NOTE = '\n\nFor any maths, powers, fractions, roots, units or chemical formulas, write them in LaTeX between dollar signs, for example $x^2$, $\\frac{a}{b}$, $\\sqrt{x}$, $H_2O$, $5 \\times 10^{3}$, $m/s^2$, $30^\\circ$. Never use the dollar sign for money, write naira or N instead.';
const aiPrompt = () => AI_PROMPT.replace('Read the attached lecture slides and write 20', 'Using the topic or notes I give you, write 20') + MATH_NOTE;

let counter = 0;
const key = () => ++counter;
const LETTERS = ['A', 'B', 'C', 'D', 'E'];

const blankQ = () => ({ k: key(), id: null, fresh: true, text: '', options: ['', '', '', ''], answer: 0, explanation: '' });
const blankSubject = () => ({ k: key(), name: '', questions: [], paste: '', pasteMsg: '' });

// <input type="datetime-local"> works in the browser's own time zone, so convert both ways.
const pad = (n) => String(n).padStart(2, '0');
function toLocal(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
const fromLocal = (v) => (v ? new Date(v).toISOString() : null);

const row = { display: 'flex', gap: 8, alignItems: 'center' };
const small = { width: 'auto' };

// memo: typing in one question must not redraw (and re-run the maths for) every other question.
const QuestionEditor = memo(function QuestionEditor({ sk, n, q, onChange, onDelete }) {
  const [opened, setOpened] = useState(Boolean(q.fresh));
  const set = (patch) => onChange(sk, q.k, { ...q, ...patch });
  const setOpt = (i, v) => set({ options: q.options.map((o, j) => (j === i ? v : o)) });
  const addOpt = () => q.options.length < 5 && set({ options: [...q.options, ''] });
  const dropOpt = (i) => {
    if (q.options.length <= 2) return;
    const options = q.options.filter((_, j) => j !== i);
    const answer = q.answer === i ? 0 : q.answer > i ? q.answer - 1 : q.answer;
    set({ options, answer });
  };
  // Cut at a word edge and never inside a $...$ pair, so a long formula is not shown half-written.
  const cut = q.text.trim().slice(0, 90);
  const label = !q.text.trim() ? 'New question' : (cut.match(/\$/g) || []).length % 2 ? q.text.trim() : cut;
  return (
    <details className="card" open={Boolean(q.fresh)} onToggle={(e) => setOpened(e.currentTarget.open)}>
      <summary style={{ display: 'flex', gap: 6, alignItems: 'baseline' }}>
        <strong>{n}.</strong>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}><Rich text={label} /></span>
      </summary>
      {opened && <div className="stack tight" style={{ marginTop: 10 }}>
        <label>Question
          <textarea rows={3} value={q.text} onChange={(e) => set({ text: e.target.value })} />
        </label>
        <div className="stack tight">
          <span className="small"><strong>Options</strong> (tick the correct one)</span>
          {q.options.map((o, i) => (
            <div key={i} style={row}>
              <input type="radio" style={small} name={`ans-${q.k}`} checked={q.answer === i} onChange={() => set({ answer: i })} aria-label={`Option ${LETTERS[i]} is correct`} />
              <strong>{LETTERS[i]}</strong>
              <input style={{ flex: 1, minWidth: 0 }} value={o} onChange={(e) => setOpt(i, e.target.value)} placeholder={`Option ${LETTERS[i]}`} />
              {q.options.length > 2 && <button type="button" className="btn sm ghost" onClick={() => dropOpt(i)} aria-label={`Remove option ${LETTERS[i]}`}>x</button>}
            </div>
          ))}
          {q.options.length < 5 && <button type="button" className="btn sm ghost" onClick={addOpt}>Add option</button>}
        </div>
        <label>Why it is correct (optional, students see it in corrections)
          <textarea rows={2} value={q.explanation} onChange={(e) => set({ explanation: e.target.value })} />
        </label>
        {q.text.trim() && (
          <div className="card stack tight" style={{ background: 'var(--tint)', borderColor: 'var(--tint-line)' }}>
            <span className="muted small">How students will see it</span>
            <p className="qtext" style={{ margin: 0 }}><Rich text={q.text} /></p>
            {q.options.map((o, i) => o.trim() && (
              <p key={i} style={{ margin: 0, fontWeight: q.answer === i ? 700 : 400 }}>
                {LETTERS[i]}. <Rich text={o} />{q.answer === i ? ' (correct)' : ''}
              </p>
            ))}
            {q.explanation.trim() && <p className="small" style={{ margin: 0 }}>Why: <Rich text={q.explanation} /></p>}
          </div>
        )}
        <div><button type="button" className="btn sm danger" onClick={() => onDelete(sk, q.k)}>Delete this question</button></div>
      </div>}
    </details>
  );
});

export default function ExamEditor({ exam = null, initialSubjects = null, attempts = 0, scope = { tracks: [], schools: [] } }) {
  const router = useRouter();
  const editing = Boolean(exam);

  const [title, setTitle] = useState(exam?.title || '');
  const [description, setDescription] = useState(exam?.description || '');
  const [timeLimit, setTimeLimit] = useState(exam?.time_limit_minutes ? String(exam.time_limit_minutes) : '');
  const [code, setCode] = useState('');
  const [opensMode, setOpensMode] = useState(exam?.opens_at ? 'at' : 'now');
  const [opensAt, setOpensAt] = useState(toLocal(exam?.opens_at));
  const [closesMode, setClosesMode] = useState(exam?.closes_at ? 'at' : 'never');
  const [closesAt, setClosesAt] = useState(toLocal(exam?.closes_at));
  const [showScore, setShowScore] = useState(exam ? exam.show_score : true);
  const [askDepartment, setAskDepartment] = useState(Boolean(exam?.ask_department));
  const [askLevel, setAskLevel] = useState(Boolean(exam?.ask_level));
  const [allowCalculator, setAllowCalculator] = useState(Boolean(exam?.allow_calculator));
  // The tutor can only file an exam under what they chose at set-up. An old exam keeps its own values.
  const trackOptions = [...new Set([...(scope.tracks || []), ...(exam?.track ? [exam.track] : [])])];
  const schoolOptions = [...new Set([...(scope.schools || []), ...(exam?.school ? [exam.school] : [])])];
  const [track, setTrack] = useState(exam?.track || (trackOptions.length === 1 ? trackOptions[0] : ''));
  const [school, setSchool] = useState(exam?.school || (schoolOptions.length === 1 ? schoolOptions[0] : ''));
  const needsSchool = NEEDS_SCHOOL.includes(track);
  const [subjects, setSubjects] = useState(initialSubjects || [blankSubject()]);
  const [showPrompt, setShowPrompt] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [ok, setOk] = useState('');
  const [link, setLink] = useState('');
  const [copied, setCopied] = useState('');

  useEffect(() => {
    if (exam) setLink(`${window.location.origin}/quiz/${exam.slug}`);
  }, [exam]);

  const total = subjects.reduce((n, s) => n + s.questions.length, 0);
  const patchSubject = (k, patch) => setSubjects((all) => all.map((s) => (s.k === k ? { ...s, ...patch } : s)));
  const patchQuestion = useCallback((sk, qk, next) =>
    setSubjects((all) => all.map((s) => (s.k === sk ? { ...s, questions: s.questions.map((q) => (q.k === qk ? next : q)) } : s))), []);
  const dropQuestion = useCallback((sk, qk) =>
    setSubjects((all) => all.map((s) => (s.k === sk ? { ...s, questions: s.questions.filter((q) => q.k !== qk) } : s))), []);

  function addPasted(s) {
    const { questions, errors } = parseQuestions(s.paste);
    if (errors.length) {
      patchSubject(s.k, { pasteMsg: errors.join(' ') });
      return;
    }
    const made = questions.map((q) => ({ k: key(), id: null, text: q.text, options: q.options, answer: q.answer, explanation: q.explanation || '' }));
    patchSubject(s.k, { questions: [...s.questions, ...made], paste: '', pasteMsg: `Added ${made.length} questions.` });
  }

  function removeSubject(s) {
    if (s.questions.length && !confirm(`Remove ${s.name || 'this subject'} and its ${s.questions.length} questions?`)) return;
    setSubjects((all) => (all.length > 1 ? all.filter((x) => x.k !== s.k) : all));
  }

  async function copy(text, what) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(what);
      setTimeout(() => setCopied(''), 1800);
    } catch {}
  }

  async function save() {
    setMsg('');
    setOk('');
    // Blank option boxes are dropped here, and the right answer is moved to match.
    const out = [];
    for (let s = 0; s < subjects.length; s++) {
      const list = [];
      for (let n = 0; n < subjects[s].questions.length; n++) {
        const q = subjects[s].questions[n];
        const kept = [];
        let answer = -1;
        q.options.forEach((o, i) => {
          if (o.trim()) {
            if (i === q.answer) answer = kept.length;
            kept.push(o.trim());
          }
        });
        if (answer === -1) {
          setMsg(`${subjects.length > 1 ? (subjects[s].name || `Subject ${s + 1}`) + ', ' : ''}question ${n + 1}: the correct option is empty.`);
          return;
        }
        list.push({ id: q.id, text: q.text, options: kept, answer, explanation: q.explanation });
      }
      out.push({ name: subjects[s].name, questions: list });
    }
    if (!track) return setMsg('Pick which exam this is for.');
    if (needsSchool && !school) return setMsg('Pick the school this exam belongs to.');
    if (opensMode === 'at' && !opensAt) return setMsg('Pick the time the exam opens, or choose "Open as soon as I save".');
    if (closesMode === 'at' && !closesAt) return setMsg('Pick the time the exam closes, or choose "I will close it myself".');

    setBusy(true);
    try {
      const res = await fetch(editing ? `/api/tutor/exams/${exam.id}` : '/api/tutor/exams', {
        method: editing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title, description, timeLimit: timeLimit || null, code: code || undefined,
          track, school: needsSchool ? school : null,
          opensAt: opensMode === 'at' ? fromLocal(opensAt) : null,
          closesAt: closesMode === 'at' ? fromLocal(closesAt) : null,
          showScore, askDepartment, askLevel, allowCalculator, subjects: out,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not save.');
      if (editing) {
        setOk('Saved.');
        setCode('');
        router.refresh();
        if (data.slug && data.slug !== exam.slug) router.replace(`/dashboard/exams/${exam.id}`);
      } else {
        router.push(`/dashboard/exams/${data.id}`);
      }
    } catch (e) {
      setMsg(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function act(action) {
    setBusy(true);
    setMsg('');
    try {
      const res = await fetch(`/api/tutor/exams/${exam.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Could not do that.');
      router.refresh();
    } catch (e) {
      setMsg(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!confirm('Delete this exam and all its results? This cannot be undone.')) return;
    setBusy(true);
    const res = await fetch(`/api/tutor/exams/${exam.id}`, { method: 'DELETE' });
    if (res.ok) router.push('/dashboard');
    else {
      setBusy(false);
      setMsg('Could not delete.');
    }
  }

  const state = exam ? examState(exam) : null;

  return (
    <div className="stack" style={{ minWidth: 0 }}>
      {editing && (
        <section className="card stack tight">
          <div className="row between">
            <h2 className="card-h">Share with students</h2>
            <span className="chip">{state === 'open' ? 'Open' : state === 'scheduled' ? `Opens ${lagos(exam.opens_at)}` : 'Closed'}</span>
          </div>
          <p className="muted small">Students open the link on the laptops, type their name and start. No account needed.</p>
          <div className="row">
            <input readOnly value={link} onFocus={(e) => e.target.select()} style={{ flex: '1 1 160px', minWidth: 0 }} aria-label="Exam link" />
            <button type="button" className="btn sm" onClick={() => copy(link, 'link')}>{copied === 'link' ? 'Copied' : 'Copy link'}</button>
          </div>
          <p className="small">Or type this code on the home page: <strong>{exam.slug}</strong>{' '}
            <button type="button" className="btn sm ghost" onClick={() => copy(exam.slug, 'code')}>{copied === 'code' ? 'Copied' : 'Copy code'}</button>
          </p>
          <div className="row">
            {state === 'open' ? (
              <button type="button" className="btn sm danger" disabled={busy} onClick={() => confirm('Close the exam now? Students who already started can still finish.') && act('close')}>Close now</button>
            ) : (
              <button type="button" className="btn sm" disabled={busy} onClick={() => act('open')}>{state === 'scheduled' ? 'Open now' : 'Reopen'}</button>
            )}
          </div>
        </section>
      )}

      <section className="card stack tight">
        <h2 className="card-h">Where this exam belongs</h2>
        {trackOptions.length === 1 ? (
          <p className="small"><strong>{TRACK_NAMES[track]}</strong></p>
        ) : (
          <label>Exam
            <select value={track} onChange={(e) => setTrack(e.target.value)}>
              <option value="">Select</option>
              {trackOptions.map((t) => <option key={t} value={t}>{TRACK_NAMES[t]}</option>)}
            </select>
          </label>
        )}
        {needsSchool && (schoolOptions.length === 1 ? (
          <p className="small"><strong>{schoolName(school)}</strong></p>
        ) : (
          <label>School
            <select value={school} onChange={(e) => setSchool(e.target.value)}>
              <option value="">Select</option>
              {schoolOptions.map((x) => <option key={x} value={x}>{schoolName(x)}</option>)}
            </select>
          </label>
        ))}
        <p className="muted small">Your exams stay inside what you chose when you set up your account.</p>
      </section>

      <section className="card stack tight">
        <h2 className="card-h">Exam details</h2>
        <label>Title
          <input value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. JAMB Mock 3, Saturday class" />
        </label>
        <label>Instructions for students (optional)
          <textarea rows={2} value={description} maxLength={500} onChange={(e) => setDescription(e.target.value)} />
        </label>
        <label>Time allowed in minutes (leave empty for no timer)
          <input type="number" inputMode="numeric" min="1" max="300" value={timeLimit} onChange={(e) => setTimeLimit(e.target.value)} style={{ maxWidth: 160 }} />
          <span className="muted small">One timer for the whole exam, even with several subjects.</span>
        </label>
        <label>{editing ? 'Change the code word (optional)' : 'Code word (optional)'}
          <input value={code} maxLength={30} onChange={(e) => setCode(e.target.value)} placeholder={editing ? `Now: ${exam.slug}` : 'e.g. jamb-mock-3, or leave empty'} autoCapitalize="none" />
          <span className="muted small">{editing ? 'Changing it breaks the old link, so only do this before you share.' : 'Leave empty and we make a short code for you.'}</span>
        </label>
      </section>

      <section className="card stack tight">
        <h2 className="card-h">When is it open?</h2>
        <div className="stack tight">
          <strong className="small">Opens</strong>
          <label style={row}><input type="radio" style={small} name="opens" checked={opensMode === 'now'} onChange={() => setOpensMode('now')} /> As soon as I save</label>
          <label style={row}><input type="radio" style={small} name="opens" checked={opensMode === 'at'} onChange={() => setOpensMode('at')} /> At a set time</label>
          {opensMode === 'at' && <input type="datetime-local" value={opensAt} onChange={(e) => setOpensAt(e.target.value)} />}
        </div>
        <div className="stack tight">
          <strong className="small">Closes</strong>
          <label style={row}><input type="radio" style={small} name="closes" checked={closesMode === 'never'} onChange={() => setClosesMode('never')} /> I will close it myself</label>
          <label style={row}><input type="radio" style={small} name="closes" checked={closesMode === 'at'} onChange={() => setClosesMode('at')} /> At a set time</label>
          {closesMode === 'at' && <input type="datetime-local" value={closesAt} onChange={(e) => setClosesAt(e.target.value)} />}
        </div>
        <p className="muted small">Times use this device's clock. When it closes, nobody new can start. Anyone already writing can still finish and hand in.</p>
      </section>

      <section className="card stack tight">
        <h2 className="card-h">What students see and give</h2>
        <label style={row}><input type="checkbox" style={small} checked={showScore} onChange={(e) => setShowScore(e.target.checked)} /> Show students their score and corrections after they finish</label>
        {!showScore && <p className="muted small">Students only see "Thank you". You see everything on your results page.</p>}
        <label style={row}><input type="checkbox" style={small} checked={askDepartment} onChange={(e) => setAskDepartment(e.target.checked)} /> Ask for department (name is always asked)</label>
        <label style={row}><input type="checkbox" style={small} checked={askLevel} onChange={(e) => setAskLevel(e.target.checked)} /> Ask for level</label>
        <label style={row}><input type="checkbox" style={small} checked={allowCalculator} onChange={(e) => setAllowCalculator(e.target.checked)} /> Allow a calculator</label>
      </section>

      <section className="stack">
        <h2>Subjects and questions</h2>
        <p className="muted small">One subject is fine. Add more for a combined exam, for example Maths, English, Physics and Chemistry in one sitting.</p>
        {attempts > 0 && (
          <p className="card small">{attempts} {attempts === 1 ? 'student has' : 'students have'} already taken this. Changing a correct answer will not change their old scores, so avoid editing questions while an exam is running.</p>
        )}

        {subjects.map((s, idx) => (
          <div key={s.k} className="card stack tight">
            <div className="row between">
              <h3 className="card-h">{subjects.length > 1 ? `Subject ${idx + 1}` : 'Questions'}</h3>
              {subjects.length > 1 && <button type="button" className="btn sm danger" onClick={() => removeSubject(s)}>Remove subject</button>}
            </div>
            <label>Subject name{subjects.length > 1 ? '' : ' (optional)'}
              <input value={s.name} maxLength={60} onChange={(e) => patchSubject(s.k, { name: e.target.value })} placeholder="e.g. Physics" />
            </label>

            {s.questions.map((q, n) => (
              <QuestionEditor key={q.k} sk={s.k} n={n + 1} q={q} onChange={patchQuestion} onDelete={dropQuestion} />
            ))}
            <div><button type="button" className="btn sm ghost" onClick={() => patchSubject(s.k, { questions: [...s.questions, blankQ()] })}>Add one question</button></div>

            <details>
              <summary><strong>Paste many questions at once</strong></summary>
              <div className="stack tight" style={{ marginTop: 10 }}>
                <p className="muted small">{'Maths can be written like $x^2$, $\\frac{a}{b}$ or $H_2O$. It is drawn properly in the preview under each question.'}</p>
                <textarea rows={8} value={s.paste} onChange={(e) => patchSubject(s.k, { paste: e.target.value, pasteMsg: '' })}
                  placeholder={'1. Question text?\nA. First option\nB. Second option\nC. Third option\nD. Fourth option\nAnswer: B\nExplanation: Why B is correct.'} />
                {s.pasteMsg && <p className={s.pasteMsg.startsWith('Added') ? 'small' : 'error small'}>{s.pasteMsg}</p>}
                <div><button type="button" className="btn sm" disabled={!s.paste.trim()} onClick={() => addPasted(s)}>Add these questions</button></div>
              </div>
            </details>
          </div>
        ))}

        {subjects.length < 12 && (
          <div><button type="button" className="btn ghost" onClick={() => setSubjects((all) => [...all, blankSubject()])}>Add another subject</button></div>
        )}

        <div className="card stack tight">
          <button type="button" className="btn sm ghost" style={{ justifySelf: 'start' }} onClick={() => setShowPrompt((v) => !v)}>
            {showPrompt ? 'Hide' : 'Need an AI to write questions for you?'}
          </button>
          {showPrompt && (
            <>
              <p className="muted small">Copy this into any AI tool with your notes or topic, then paste the answer into "Paste many questions at once".</p>
              <textarea readOnly rows={12} value={aiPrompt()} />
              <div><button type="button" className="btn sm" onClick={() => copy(aiPrompt(), 'prompt')}>{copied === 'prompt' ? 'Copied' : 'Copy prompt'}</button></div>
            </>
          )}
        </div>
      </section>

      {msg && <p className="error">{msg}</p>}
      {ok && <p className="small" style={{ color: 'var(--ok)' }}>{ok}</p>}
      <div className="row">
        <button type="button" className="btn" disabled={busy || !total} onClick={save}>
          {busy ? 'Saving...' : editing ? `Save changes (${total} questions)` : `Create exam (${total} questions)`}
        </button>
        {editing && <button type="button" className="btn sm danger" disabled={busy} onClick={remove}>Delete exam</button>}
      </div>
    </div>
  );
}