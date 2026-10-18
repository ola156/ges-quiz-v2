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
const blankSubject = () => ({ k: key(), name: '', questions: [], paste: '', pasteMsg: '', pasteOpen: false, required: false, minutes: '' });

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

const STEPS = [
  { title: 'Basics', line: 'Name the exam and say which exam it belongs to.' },
  { title: 'Questions', line: 'Type or paste the questions students will answer.' },
  { title: 'Students', line: 'Decide who sees what, and whether students choose their subjects.' },
  { title: 'Timing', line: 'Set the timer and when the exam opens and closes.' },
  { title: 'Review', line: 'Check everything, then publish.' },
];

const CSS = `
.ee-steps { list-style: none; margin: 0; padding: 0; display: flex; justify-content: space-between; gap: 2px; border-bottom: 1px solid var(--surface-line); }
.ee-steps li { min-width: 0; }
.ee-steps button { display: flex; align-items: center; gap: 8px; padding: 10px 10px; border: 0; border-bottom: 3px solid transparent; background: none; color: var(--on-dark-muted); font: inherit; font-weight: 600; cursor: pointer; white-space: nowrap; }
.ee-steps button:hover { color: var(--on-dark); }
.ee-steps .on button { color: var(--head); border-bottom-color: var(--blue); }
.ee-n { display: grid; place-items: center; width: 24px; height: 24px; border-radius: 50%; border: 2px solid var(--surface-line); font-size: 0.8rem; }
.ee-steps .on .ee-n { background: var(--blue); border-color: var(--blue); color: #fff; }
.ee-steps .done .ee-n { background: var(--ok); border-color: var(--ok); color: #fff; }
.ee-head { display: grid; gap: 4px; }
.ee-head h2 { margin: 0; font-size: 1.3rem; }
.ee-head p { color: var(--on-dark-muted); }
.ee-field { display: grid; gap: 6px; }
.ee-hint { font-weight: 400; font-size: 0.85rem; color: var(--on-dark-muted); }
.ee-group { display: grid; gap: 4px; }
.ee-group > strong { color: var(--head); }
.ee-list { border-top: 1px solid var(--surface-line); }
.ee-opt { display: flex; align-items: flex-start; gap: 12px; padding: 12px 4px; border-bottom: 1px solid var(--surface-line); cursor: pointer; color: var(--on-dark); font-weight: 400; }
.ee-opt:hover { background: var(--wash); }
.ee-opt input[type='radio'], .ee-opt input[type='checkbox'] { flex: none; width: 20px; height: 20px; padding: 0; margin: 2px 0 0; accent-color: var(--blue); }
.ee-opt b { display: block; color: var(--head); font-weight: 600; }
.ee-opt small { display: block; margin-top: 1px; color: var(--on-dark-muted); font-size: 0.85rem; }
.ee-sub { padding-left: 32px; display: grid; gap: 8px; }
.ee-sub-row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.ee-sub-row > span { flex: 1; min-width: 100px; color: var(--head); font-weight: 600; }
.ee-sub-row input[type='number'] { width: 90px; }
.ee-sub-row label { display: flex; align-items: center; gap: 6px; font-weight: 400; color: var(--on-dark); }
.ee-sub-row input[type='checkbox'] { width: 18px; height: 18px; padding: 0; accent-color: var(--blue); }
.ee-block { display: grid; gap: 12px; padding: 16px 0; border-top: 1px solid var(--surface-line); }
.ee-block-top { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.ee-block-top h3 { margin: 0; font-size: 1.05rem; color: var(--head); }
.ee-acts { display: flex; flex-wrap: wrap; gap: 8px; }
.ee-sum { margin: 0; display: grid; border-top: 1px solid var(--surface-line); }
.ee-sum > div { display: grid; grid-template-columns: minmax(110px, 1fr) 3fr; gap: 12px; padding: 12px 4px; border-bottom: 1px solid var(--surface-line); }
.ee-sum dt { color: var(--on-dark-muted); }
.ee-sum dd { margin: 0; color: var(--head); font-weight: 600; overflow-wrap: anywhere; }
.ee-sum dd small { display: block; font-weight: 400; color: var(--on-dark-muted); }
.ee-nav { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding-top: 8px; }
.ee-nav .btn { display: inline-flex; align-items: center; gap: 8px; }
.ee-after { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 4px 16px; }

/* quiet text actions, so not everything is a button */
.ee-link { display: inline-flex; align-items: center; gap: 6px; padding: 6px 0; border: 0; background: none; font: inherit; font-weight: 600; color: var(--link); text-decoration: none; cursor: pointer; }
.ee-link:hover { text-decoration: underline; text-underline-offset: 3px; }
.ee-link:disabled { opacity: 0.4; cursor: default; text-decoration: none; }
.ee-link.danger { color: var(--bad); }
.card .ee-link { color: var(--blue); }
.card .ee-link.danger { color: var(--red); }
.ee-x { display: grid; place-items: center; flex: none; width: 32px; height: 32px; border: 0; border-radius: 50%; background: var(--tint); color: var(--blue-dark); font: inherit; font-size: 1rem; line-height: 1; cursor: pointer; }
.ee-x:hover { background: var(--tint-line); }
.ee-links { display: flex; flex-wrap: wrap; gap: 2px 20px; }

/* long words and long maths must never push the page wider than the screen */
.ee-block, details.card, details.card .stack { grid-template-columns: minmax(0, 1fr); }
.ee-block > *, details.card > *, details.card .stack > * { min-width: 0; }
details.card { min-width: 0; }
details.card summary, details.card p, details.card label { overflow-wrap: anywhere; }
details.card p { max-width: 100%; overflow-x: auto; }
details.card .katex-display { max-width: 100%; overflow-x: auto; overflow-y: hidden; }
.ee-qrow { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 2px 8px; align-items: baseline; }
.ee-qtext { display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 3; overflow: hidden; line-height: 1.5; }
.ee-qmeta { grid-column: 2; font-size: 0.8rem; font-weight: 500; color: var(--muted); }
.ee-shows { margin: 0; font-size: 0.95rem; color: var(--ink); }
.ee-shows i { font-style: normal; font-size: 0.75rem; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; color: var(--muted); margin-right: 8px; }

/* share panel: three short lines, no box */
.ee-share { display: grid; gap: 8px; padding: 14px 0; border-top: 1px solid var(--surface-line); border-bottom: 1px solid var(--surface-line); }
.ee-share-top { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.ee-share-top strong { color: var(--head); font-size: 1.05rem; }
.ee-state { padding: 2px 10px; border-radius: 99px; background: var(--wash-strong); color: var(--on-dark); font-size: 0.78rem; font-weight: 700; white-space: nowrap; }
.ee-share-link { display: flex; align-items: center; gap: 12px; }
.ee-share-link input { flex: 1; min-width: 0; padding: 10px 12px; text-overflow: ellipsis; }
.ee-share-row { display: flex; flex-wrap: wrap; align-items: center; gap: 2px 18px; }
.ee-share-row span { color: var(--on-dark-muted); }
.ee-share-row b { color: var(--head); font-family: var(--font-mono), monospace; letter-spacing: 0.06em; }

/* phones: the five steps become five numbers, with the open one named */
@media (max-width: 600px) {
  .ee-steps button { padding: 10px 6px; gap: 6px; }
  .ee-steps .lbl { display: none; }
  .ee-steps .on .lbl { display: inline; }
  .ee-steps li.on { flex: 1 1 auto; }
  .ee-steps li.on button { width: 100%; }
}
`;

// memo: typing in one question must not redraw (and re-run the maths for) every other question.
// A single quiet line under a field, shown only when the text has maths in it, so the formula can be checked.
const Shows = ({ text }) => (/\$/.test(text) && text.trim() ? <p className="ee-shows"><i>Shows as</i><Rich text={text} /></p> : null);

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
  const cut = q.text.trim().slice(0, 180);
  const label = !q.text.trim() ? 'New question' : (cut.match(/\$/g) || []).length % 2 ? q.text.trim() : cut;
  return (
    <details className="card" open={Boolean(q.fresh)} onToggle={(e) => setOpened(e.currentTarget.open)}>
      <summary className="ee-qrow">
        <strong>{n}.</strong>
        <span className="ee-qtext"><Rich text={label} /></span>
        <span className="ee-qmeta">Correct answer: {LETTERS[q.answer]}</span>
      </summary>
      {opened && <div className="stack tight" style={{ marginTop: 10 }}>
        <label>Question
          <textarea rows={3} value={q.text} onChange={(e) => set({ text: e.target.value })} />
        </label>
        <Shows text={q.text} />
        <div className="stack tight">
          <span className="small"><strong>Options</strong> (tick the correct one)</span>
          {q.options.map((o, i) => (
            <div key={i} className="stack tight" style={{ gap: 4 }}>
              <div style={row}>
                <input type="radio" style={small} name={`ans-${q.k}`} checked={q.answer === i} onChange={() => set({ answer: i })} aria-label={`Option ${LETTERS[i]} is correct`} />
                <strong>{LETTERS[i]}</strong>
                <input style={{ flex: 1, minWidth: 0 }} value={o} onChange={(e) => setOpt(i, e.target.value)} placeholder={`Option ${LETTERS[i]}`} />
                {q.options.length > 2 && <button type="button" className="ee-x" onClick={() => dropOpt(i)} aria-label={`Remove option ${LETTERS[i]}`}>&#10005;</button>}
              </div>
              <Shows text={o} />
            </div>
          ))}
          {q.options.length < 5 && <div><button type="button" className="ee-link" onClick={addOpt}>+ Add option</button></div>}
        </div>
        <label>Why it is correct (optional, students see it in corrections)
          <textarea rows={2} value={q.explanation} onChange={(e) => set({ explanation: e.target.value })} />
        </label>
        <Shows text={q.explanation} />
        <div><button type="button" className="ee-link danger" onClick={() => onDelete(sk, q.k)}>Delete this question</button></div>
      </div>}
    </details>
  );
});

export default function ExamEditor({ exam = null, initialSubjects = null, attempts = 0, scope = { tracks: [], schools: [] } }) {
  const router = useRouter();
  const editing = Boolean(exam);
  const first = initialSubjects || [blankSubject()];

  const [step, setStep] = useState(0);
  const [title, setTitle] = useState(exam?.title || '');
  const [description, setDescription] = useState(exam?.description || '');
  const [timeMode, setTimeMode] = useState(exam?.time_limit_minutes ? 'fixed' : first.length > 1 && first.some((s) => s.minutes) ? 'subject' : 'none');
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
  const [pickSubjects, setPickSubjects] = useState(Boolean(exam?.pick_subjects));
  const [maxSubjects, setMaxSubjects] = useState(exam?.max_subjects ? String(exam.max_subjects) : '');
  // The tutor can only file an exam under what they chose at set-up. An old exam keeps its own values.
  const trackOptions = [...new Set([...(scope.tracks || []), ...(exam?.track ? [exam.track] : [])])];
  const schoolOptions = [...new Set([...(scope.schools || []), ...(exam?.school ? [exam.school] : [])])];
  const [track, setTrack] = useState(exam?.track || (trackOptions.length === 1 ? trackOptions[0] : ''));
  const [school, setSchool] = useState(exam?.school || (schoolOptions.length === 1 ? schoolOptions[0] : ''));
  const needsSchool = NEEDS_SCHOOL.includes(track);
  const [subjects, setSubjects] = useState(first);
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
  const multi = subjects.length > 1;
  const mode = multi || timeMode !== 'subject' ? timeMode : 'none';
  const requiredCount = subjects.filter((s) => s.required).length;
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

  // Says what is wrong and which step to open. null means ready.
  function problem() {
    if (!title.trim()) return { msg: 'Give the exam a title.', step: 0 };
    if (!track) return { msg: 'Pick which exam this is for.', step: 0 };
    if (needsSchool && !school) return { msg: 'Pick the school this exam belongs to.', step: 0 };
    if (multi && subjects.some((s) => !s.name.trim())) return { msg: 'Every subject needs a name.', step: 1 };
    if (!total) return { msg: 'Add at least one question.', step: 1 };
    if (subjects.some((s) => !s.questions.length)) return { msg: `${subjects.find((s) => !s.questions.length).name || 'A subject'} has no questions. Add some or remove the subject.`, step: 1 };
    if (multi && pickSubjects && requiredCount === subjects.length) return { msg: 'Every subject is compulsory, so students have nothing to pick. Untick some, or turn the picker off.', step: 2 };
    if (multi && pickSubjects && maxSubjects && Number(maxSubjects) < requiredCount) return { msg: `${requiredCount} subjects are compulsory, so the limit cannot be lower than ${requiredCount}.`, step: 2 };
    if (mode === 'fixed' && !timeLimit) return { msg: 'Type the number of minutes, or choose "No timer".', step: 3 };
    if (mode === 'subject' && subjects.some((s) => !s.minutes)) return { msg: 'Give every subject its minutes.', step: 3 };
    if (opensMode === 'at' && !opensAt) return { msg: 'Pick the time the exam opens, or choose "As soon as I publish".', step: 3 };
    if (closesMode === 'at' && !closesAt) return { msg: 'Pick the time the exam closes, or choose "I will close it myself".', step: 3 };
    return null;
  }

  async function save() {
    setMsg('');
    setOk('');
    const bad = problem();
    if (bad) {
      setMsg(bad.msg);
      setStep(bad.step);
      return;
    }
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
          setMsg(`${multi ? (subjects[s].name || `Subject ${s + 1}`) + ', ' : ''}question ${n + 1}: the correct option is empty.`);
          setStep(1);
          return;
        }
        list.push({ id: q.id, text: q.text, options: kept, answer, explanation: q.explanation });
      }
      out.push({ name: subjects[s].name, questions: list, required: multi && pickSubjects && subjects[s].required, minutes: mode === 'subject' ? subjects[s].minutes : null });
    }

    setBusy(true);
    try {
      const res = await fetch(editing ? `/api/tutor/exams/${exam.id}` : '/api/tutor/exams', {
        method: editing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title, description, timeLimit: mode === 'fixed' ? timeLimit : null, code: code || undefined,
          track, school: needsSchool ? school : null,
          opensAt: opensMode === 'at' ? fromLocal(opensAt) : null,
          closesAt: closesMode === 'at' ? fromLocal(closesAt) : null,
          showScore, askDepartment, askLevel, allowCalculator,
          pickSubjects: multi && pickSubjects, maxSubjects: multi && pickSubjects && maxSubjects ? maxSubjects : null,
          subjects: out,
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
  const done = [
    Boolean(title.trim() && track && (!needsSchool || school)),
    total > 0 && !subjects.some((s) => !s.questions.length) && (!multi || subjects.every((s) => s.name.trim())),
    true,
    mode === 'none' || (mode === 'fixed' ? Boolean(timeLimit) : subjects.every((s) => s.minutes)),
    false,
  ];
  const go = (n) => { setStep(n); setMsg(''); setOk(''); window.scrollTo({ top: 0 }); };

  const timeText = mode === 'fixed' ? `${timeLimit || '?'} minutes for the whole exam`
    : mode === 'subject' ? `Minutes per subject: ${subjects.map((s) => `${s.name || '?'} ${s.minutes || '?'}`).join(', ')}`
      : 'No timer';
  const subjectsText = !multi ? (subjects[0].name || 'One subject')
    : pickSubjects
      ? `Students pick their subjects${maxSubjects ? `, up to ${maxSubjects}` : ''}${requiredCount ? `. Compulsory: ${subjects.filter((s) => s.required).map((s) => s.name || '?').join(', ')}` : ''}`
      : `Every student answers all ${subjects.length} subjects`;

  return (
    <div className="stack" style={{ minWidth: 0, gridTemplateColumns: 'minmax(0, 1fr)' }}>
      <style>{CSS}</style>

      {editing && (
        <section className="ee-share">
          <div className="ee-share-top">
            <strong>Share with students</strong>
            <span className="ee-state">{state === 'open' ? 'Open' : state === 'scheduled' ? `Opens ${lagos(exam.opens_at)}` : 'Closed'}</span>
          </div>
          <div className="ee-share-link">
            <input readOnly value={link} onFocus={(e) => e.target.select()} aria-label="Exam link" />
            <button type="button" className="ee-link" onClick={() => copy(link, 'link')}>{copied === 'link' ? 'Copied' : 'Copy link'}</button>
          </div>
          <div className="ee-share-row">
            <span>Code <b>{exam.slug}</b></span>
            <button type="button" className="ee-link" onClick={() => copy(exam.slug, 'code')}>{copied === 'code' ? 'Copied' : 'Copy code'}</button>
            {state === 'open' ? (
              <button type="button" className="ee-link danger" disabled={busy} onClick={() => confirm('Close the exam now? Students who already started can still finish.') && act('close')}>Close exam</button>
            ) : (
              <button type="button" className="ee-link" disabled={busy} onClick={() => act('open')}>{state === 'scheduled' ? 'Open now' : 'Reopen'}</button>
            )}
          </div>
        </section>
      )}

      <ol className="ee-steps" aria-label="Steps">
        {STEPS.map((s, n) => (
          <li key={s.title} className={`${n === step ? 'on' : ''} ${done[n] && n !== step ? 'done' : ''}`}>
            <button type="button" onClick={() => go(n)} aria-current={n === step ? 'step' : undefined}>
              <span className="ee-n">{done[n] && n !== step ? '✓' : n + 1}</span><span className="lbl">{s.title}</span>
            </button>
          </li>
        ))}
      </ol>

      <div className="ee-head">
        <h2>Step {step + 1} of {STEPS.length}: {STEPS[step].title}</h2>
        <p>{STEPS[step].line}</p>
      </div>

      {/* ---------- 1. Basics ---------- */}
      {step === 0 && (
        <div className="stack">
          {trackOptions.length === 1 ? (
            <div className="ee-field">
              <strong>Exam</strong>
              <span>{TRACK_NAMES[track]}</span>
            </div>
          ) : (
            <label className="ee-field">Which exam is this for?
              <select value={track} onChange={(e) => setTrack(e.target.value)}>
                <option value="">Select</option>
                {trackOptions.map((t) => <option key={t} value={t}>{TRACK_NAMES[t]}</option>)}
              </select>
              <span className="ee-hint">Students preparing for this exam will find it under Practice.</span>
            </label>
          )}
          {needsSchool && (schoolOptions.length === 1 ? (
            <div className="ee-field"><strong>School</strong><span>{schoolName(school)}</span></div>
          ) : (
            <label className="ee-field">Which school?
              <select value={school} onChange={(e) => setSchool(e.target.value)}>
                <option value="">Select</option>
                {schoolOptions.map((x) => <option key={x} value={x}>{schoolName(x)}</option>)}
              </select>
            </label>
          ))}
          <label className="ee-field">Title
            <input value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. JAMB Mock 3, Saturday class" />
            <span className="ee-hint">Students see this at the top of the exam.</span>
          </label>
          <label className="ee-field">Instructions for students (optional)
            <textarea rows={3} value={description} maxLength={500} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. No phones. Answer all questions." />
          </label>
        </div>
      )}

      {/* ---------- 2. Questions ---------- */}
      {step === 1 && (
        <div className="stack">
          <p className="muted small">
            {multi
              ? 'This is a combined exam. Each subject has its own questions, so students can switch between subjects while writing.'
              : 'Add your questions below. For a combined exam such as JAMB, use "Add another subject" at the bottom.'}
          </p>
          {attempts > 0 && (
            <p className="card small">{attempts} {attempts === 1 ? 'student has' : 'students have'} already taken this. Changing a correct answer will not change their old scores, so avoid editing questions while an exam is running.</p>
          )}

          {subjects.map((s, idx) => (
            <div key={s.k} className="ee-block">
              <div className="ee-block-top">
                <h3>{multi ? `Subject ${idx + 1}${s.name ? `: ${s.name}` : ''}` : 'Questions'} <span className="muted small">({s.questions.length})</span></h3>
                {multi && <button type="button" className="ee-link danger" onClick={() => removeSubject(s)}>Remove</button>}
              </div>
              <label className="ee-field">Subject name{multi ? '' : ' (optional)'}
                <input value={s.name} maxLength={60} onChange={(e) => patchSubject(s.k, { name: e.target.value })} placeholder="e.g. Physics" />
              </label>

              {s.questions.map((q, n) => (
                <QuestionEditor key={q.k} sk={s.k} n={n + 1} q={q} onChange={patchQuestion} onDelete={dropQuestion} />
              ))}
              {!s.questions.length && <p className="muted small">No questions yet. Paste a batch or add them one at a time.</p>}

              <div className="ee-links">
                <button type="button" className="ee-link" onClick={() => patchSubject(s.k, { questions: [...s.questions, blankQ()] })}>+ Add one question</button>
                <button type="button" className="ee-link" onClick={() => patchSubject(s.k, { pasteOpen: !s.pasteOpen })}>{s.pasteOpen ? 'Hide paste box' : '+ Paste many questions'}</button>
              </div>

              {s.pasteOpen && (
                <div className="stack tight">
                  <p className="muted small">Paste questions in this shape. Each one needs an Answer line, and Explanation is optional. Maths like {'$x^2$'} or {'$H_2O$'} is drawn properly.</p>
                  <textarea rows={9} value={s.paste} onChange={(e) => patchSubject(s.k, { paste: e.target.value, pasteMsg: '' })}
                    placeholder={'1. Question text?\nA. First option\nB. Second option\nC. Third option\nD. Fourth option\nAnswer: B\nExplanation: Why B is correct.'} />
                  {s.pasteMsg && <p className={s.pasteMsg.startsWith('Added') ? 'small' : 'error small'}>{s.pasteMsg}</p>}
                  <div><button type="button" className="btn sm" disabled={!s.paste.trim()} onClick={() => addPasted(s)}>Add these questions</button></div>
                </div>
              )}
            </div>
          ))}

          {subjects.length < 12 && (
            <div className="ee-block">
              <div><button type="button" className="ee-link" onClick={() => setSubjects((all) => [...all, blankSubject()])}>+ Add another subject</button></div>
              <p className="ee-hint">Only for combined exams, for example Maths, English, Physics and Chemistry in one sitting.</p>
            </div>
          )}

          <div className="ee-block">
            <div><button type="button" className="ee-link" onClick={() => setShowPrompt((v) => !v)}>{showPrompt ? 'Hide the AI prompt' : 'Need an AI to write questions for you? ›'}</button></div>
            {showPrompt && (
              <>
                <p className="muted small">Copy this into any AI tool with your notes or topic. Then paste its answer into "Paste many questions".</p>
                <textarea readOnly rows={12} value={aiPrompt()} />
                <div><button type="button" className="ee-link" onClick={() => copy(aiPrompt(), 'prompt')}>{copied === 'prompt' ? 'Copied' : 'Copy prompt'}</button></div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ---------- 3. Students ---------- */}
      {step === 2 && (
        <div className="stack">
          {multi ? (
            <div className="ee-group">
              <strong>Subjects</strong>
              <div className="ee-list">
                <label className="ee-opt">
                  <input type="radio" name="pick" checked={!pickSubjects} onChange={() => setPickSubjects(false)} />
                  <span><b>Every student answers every subject</b><small>All {subjects.length} subjects, for everyone.</small></span>
                </label>
                <label className="ee-opt">
                  <input type="radio" name="pick" checked={pickSubjects} onChange={() => setPickSubjects(true)} />
                  <span><b>Students choose their own subjects</b><small>Good for JAMB, where not everyone writes the same subjects. Each student ticks theirs before they start, and is only marked on those.</small></span>
                </label>
              </div>
              {pickSubjects && (
                <div className="ee-sub">
                  <span className="ee-hint">Tick Compulsory for subjects every student must take, such as English. Students cannot untick them.</span>
                  {subjects.map((s) => (
                    <div key={s.k} className="ee-sub-row">
                      <span>{s.name || 'Unnamed subject'}</span>
                      <label><input type="checkbox" checked={s.required} onChange={(e) => patchSubject(s.k, { required: e.target.checked })} /> Compulsory</label>
                    </div>
                  ))}
                  <label className="ee-field">Most subjects a student can pick (optional)
                    <input type="number" inputMode="numeric" min="1" max={subjects.length} value={maxSubjects} onChange={(e) => setMaxSubjects(e.target.value)} style={{ maxWidth: 120 }} placeholder="No limit" />
                    <span className="ee-hint">JAMB students write 4, so type 4. Compulsory subjects count towards the limit.</span>
                  </label>
                </div>
              )}
            </div>
          ) : (
            <p className="muted small">This exam has one subject. If you add more subjects in Step 2, you can let students choose which ones they take.</p>
          )}

          <div className="ee-group">
            <strong>What students give</strong>
            <div className="ee-list">
              <div className="ee-opt" style={{ cursor: 'default' }}><span><b>Name</b><small>Always asked.</small></span></div>
              <label className="ee-opt"><input type="checkbox" checked={askDepartment} onChange={(e) => setAskDepartment(e.target.checked)} /><span><b>Department</b><small>Ask for it before they start.</small></span></label>
              <label className="ee-opt"><input type="checkbox" checked={askLevel} onChange={(e) => setAskLevel(e.target.checked)} /><span><b>Level</b><small>100 level, 200 level and so on.</small></span></label>
            </div>
          </div>

          <div className="ee-group">
            <strong>What students see</strong>
            <div className="ee-list">
              <label className="ee-opt"><input type="checkbox" checked={showScore} onChange={(e) => setShowScore(e.target.checked)} /><span><b>Their score and corrections</b><small>{showScore ? 'Shown right after they hand in.' : 'Off: students only see "Thank you". You see everything on your results page.'}</small></span></label>
              <label className="ee-opt"><input type="checkbox" checked={allowCalculator} onChange={(e) => setAllowCalculator(e.target.checked)} /><span><b>A calculator</b><small>A simple calculator on screen during the exam.</small></span></label>
            </div>
          </div>
        </div>
      )}

      {/* ---------- 4. Timing ---------- */}
      {step === 3 && (
        <div className="stack">
          <div className="ee-group">
            <strong>Timer</strong>
            <div className="ee-list">
              <label className="ee-opt"><input type="radio" name="tm" checked={mode === 'none'} onChange={() => setTimeMode('none')} /><span><b>No timer</b><small>Students take as long as they need.</small></span></label>
              <label className="ee-opt"><input type="radio" name="tm" checked={mode === 'fixed'} onChange={() => setTimeMode('fixed')} /><span><b>One time for the whole exam</b><small>The same number of minutes whichever subjects a student takes.</small></span></label>
              {multi && <label className="ee-opt"><input type="radio" name="tm" checked={mode === 'subject'} onChange={() => setTimeMode('subject')} /><span><b>Minutes for each subject</b><small>{pickSubjects ? "A student's time adds up from the subjects they pick." : 'The exam time is the minutes of all subjects added together.'}</small></span></label>}
            </div>
            {mode === 'fixed' && (
              <label className="ee-field" style={{ paddingLeft: 32 }}>Minutes
                <input type="number" inputMode="numeric" min="1" max="300" value={timeLimit} onChange={(e) => setTimeLimit(e.target.value)} style={{ maxWidth: 140 }} />
              </label>
            )}
            {mode === 'subject' && (
              <div className="ee-sub">
                {subjects.map((s) => (
                  <div key={s.k} className="ee-sub-row">
                    <span>{s.name || 'Unnamed subject'}</span>
                    <input type="number" inputMode="numeric" min="1" max="300" value={s.minutes} onChange={(e) => patchSubject(s.k, { minutes: e.target.value })} aria-label={`Minutes for ${s.name || 'subject'}`} />
                    <span className="ee-hint" style={{ flex: 'none', minWidth: 0 }}>min</span>
                  </div>
                ))}
                <span className="ee-hint">All subjects together: {subjects.reduce((n, s) => n + (Number(s.minutes) || 0), 0)} minutes.</span>
              </div>
            )}
          </div>

          <div className="ee-group">
            <strong>Opens</strong>
            <div className="ee-list">
              <label className="ee-opt"><input type="radio" name="opens" checked={opensMode === 'now'} onChange={() => setOpensMode('now')} /><span><b>As soon as I publish</b></span></label>
              <label className="ee-opt"><input type="radio" name="opens" checked={opensMode === 'at'} onChange={() => setOpensMode('at')} /><span><b>At a set time</b></span></label>
            </div>
            {opensMode === 'at' && <input type="datetime-local" value={opensAt} onChange={(e) => setOpensAt(e.target.value)} style={{ maxWidth: 260 }} />}
          </div>

          <div className="ee-group">
            <strong>Closes</strong>
            <div className="ee-list">
              <label className="ee-opt"><input type="radio" name="closes" checked={closesMode === 'never'} onChange={() => setClosesMode('never')} /><span><b>I will close it myself</b></span></label>
              <label className="ee-opt"><input type="radio" name="closes" checked={closesMode === 'at'} onChange={() => setClosesMode('at')} /><span><b>At a set time</b></span></label>
            </div>
            {closesMode === 'at' && <input type="datetime-local" value={closesAt} onChange={(e) => setClosesAt(e.target.value)} style={{ maxWidth: 260 }} />}
            <span className="ee-hint">Times use this device's clock. When it closes, nobody new can start. Anyone already writing can still finish and hand in.</span>
          </div>

          <label className="ee-field">{editing ? 'Change the code word (optional)' : 'Code word (optional)'}
            <input value={code} maxLength={30} onChange={(e) => setCode(e.target.value)} placeholder={editing ? `Now: ${exam.slug}` : 'e.g. jamb-mock-3, or leave empty'} autoCapitalize="none" style={{ maxWidth: 300 }} />
            <span className="ee-hint">{editing ? 'Changing it breaks the old link, so only do this before you share.' : 'Students type this on the home page. Leave empty and we make a short one for you.'}</span>
          </label>
        </div>
      )}

      {/* ---------- 5. Review ---------- */}
      {step === 4 && (
        <div className="stack">
          <dl className="ee-sum">
            <div><dt>Exam</dt><dd>{track ? TRACK_NAMES[track] : 'Not chosen'}{needsSchool && school ? <small>{schoolName(school)}</small> : null}</dd></div>
            <div><dt>Title</dt><dd>{title.trim() || 'Not set'}</dd></div>
            <div><dt>Questions</dt><dd>{total} in {subjects.length} {subjects.length === 1 ? 'subject' : 'subjects'}<small>{subjects.map((s) => `${s.name || 'Questions'}: ${s.questions.length}`).join('  ·  ')}</small></dd></div>
            <div><dt>Subjects</dt><dd>{subjectsText}</dd></div>
            <div><dt>Timer</dt><dd>{timeText}</dd></div>
            <div><dt>Opens</dt><dd>{opensMode === 'at' && opensAt ? new Date(opensAt).toLocaleString() : 'As soon as you publish'}</dd></div>
            <div><dt>Closes</dt><dd>{closesMode === 'at' && closesAt ? new Date(closesAt).toLocaleString() : 'When you close it'}</dd></div>
            <div><dt>Students give</dt><dd>Name{askDepartment ? ', department' : ''}{askLevel ? ', level' : ''}</dd></div>
            <div><dt>Students see</dt><dd>{showScore ? 'Score and corrections' : 'Only "Thank you"'}{allowCalculator ? ', with a calculator' : ''}</dd></div>
          </dl>
          <p className="muted small">Tap a step above to change anything. {editing ? 'Saving updates the exam straight away.' : 'After you publish, you get a link and a code to share.'}</p>
        </div>
      )}

      {msg && <p className="error" role="alert">{msg}</p>}
      {ok && <p className="small" style={{ color: 'var(--ok)' }}>{ok}</p>}

      <div className="ee-nav">
        {step > 0 ? <button type="button" className="ee-link" onClick={() => go(step - 1)}>&larr; Back</button> : <span />}
        {step < STEPS.length - 1 ? (
          <button type="button" className="btn" onClick={() => go(step + 1)}>Next: {STEPS[step + 1].title} <span aria-hidden="true">&rarr;</span></button>
        ) : (
          <button type="button" className="btn" disabled={busy || !total} onClick={save}>
            {busy ? 'Saving...' : editing ? 'Save changes' : 'Publish exam'}
          </button>
        )}
      </div>
      {(editing || step === STEPS.length - 1) && (
        <div className="ee-after">
          {editing && step < STEPS.length - 1 ? <button type="button" className="ee-link" disabled={busy || !total} onClick={save}>Save changes now</button> : <span className="muted small">{total} questions</span>}
          {editing && step === STEPS.length - 1 && <button type="button" className="ee-link danger" disabled={busy} onClick={remove}>Delete this exam</button>}
        </div>
      )}
    </div>
  );
}