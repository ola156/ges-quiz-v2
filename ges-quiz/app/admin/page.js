'use client';
import { useEffect, useMemo, useState } from 'react';
import { parseQuestions, AI_PROMPT } from '../../lib/parse';

const LETTERS = ['A', 'B', 'C', 'D', 'E'];
const EMPTY = { title: '', course: '', description: '', timeLimit: '', raw: '' };

export default function Admin() {
  const [pw, setPw] = useState('');
  const [authed, setAuthed] = useState(false);
  const [quizzes, setQuizzes] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  const parsed = useMemo(() => parseQuestions(form.raw), [form.raw]);
  const headers = { 'Content-Type': 'application/json', 'x-admin-password': pw };

  async function load(password = pw) {
    const res = await fetch('/api/admin/quizzes', { headers: { 'x-admin-password': password } });
    if (res.status === 401) { setAuthed(false); setMsg('Wrong password'); return false; }
    const data = await res.json();
    setQuizzes(data.quizzes || []);
    setAuthed(true);
    setMsg('');
    return true;
  }

  useEffect(() => {
    const saved = sessionStorage.getItem('adminpw');
    if (saved) { setPw(saved); load(saved); }
  }, []);

  async function login(e) {
    e.preventDefault();
    if (await load()) sessionStorage.setItem('adminpw', pw);
  }

  async function publish() {
    setBusy(true); setMsg('');
    const res = await fetch('/api/admin/quizzes', {
      method: 'POST', headers,
      body: JSON.stringify({
        title: form.title, course: form.course, description: form.description,
        timeLimit: form.timeLimit, questions: parsed.questions,
      }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) return setMsg(data.error || 'Failed to publish');
    setMsg(`Published: ${window.location.origin}/quiz/${data.slug}`);
    setForm(EMPTY);
    load();
  }

  async function toggle(q) {
    await fetch('/api/admin/quizzes', { method: 'PATCH', headers, body: JSON.stringify({ id: q.id, published: !q.published }) });
    load();
  }

  async function setTime(q) {
    const v = prompt('Time limit in minutes. Leave empty for no timer.', q.time_limit_minutes || '');
    if (v === null) return;
    await fetch('/api/admin/quizzes', { method: 'PATCH', headers, body: JSON.stringify({ id: q.id, time_limit_minutes: v }) });
    load();
  }

  async function copyTop(q) {
    const res = await fetch(`/api/admin/weekly?course=${encodeURIComponent(q.course)}`, { headers: { 'x-admin-password': pw } });
    const data = await res.json();
    if (!res.ok) return alert(data.error || 'Failed');
    await navigator.clipboard.writeText(data.text);
    alert('Copied. Paste it into your WhatsApp groups.');
  }

  async function remove(q) {
    if (!confirm(`Delete "${q.title}" and its submissions?`)) return;
    await fetch('/api/admin/quizzes', { method: 'DELETE', headers, body: JSON.stringify({ id: q.id }) });
    load();
  }

  if (!authed)
    return (
      <form className="stack" onSubmit={login}>
        <h1>Admin</h1>
        <label>Password
          <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} />
        </label>
        {msg && <p className="error">{msg}</p>}
        <button className="btn">Log in</button>
      </form>
    );

  const canPublish = form.title.trim() && parsed.questions.length && !busy;

  return (
    <div className="stack">
      <h1>Add a quiz</h1>

      <details className="card">
        <summary>AI prompt (copy this with your slides)</summary>
        <pre className="prompt">{AI_PROMPT}</pre>
        <button className="btn ghost" onClick={() => navigator.clipboard.writeText(AI_PROMPT)}>Copy prompt</button>
      </details>

      <label>Title
        <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="GES 101 Set A" />
      </label>
      <label>Course
        <input value={form.course} onChange={(e) => setForm({ ...form, course: e.target.value })} placeholder="GES 101" />
        <span className="muted small">Sets with the same course name share one overall leaderboard.</span>
      </label>
      <label>Description (optional)
        <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Chapters 1 to 3" />
      </label>
      <label>Time limit in minutes (optional)
        <input type="number" min="1" max="300" inputMode="numeric" value={form.timeLimit} onChange={(e) => setForm({ ...form, timeLimit: e.target.value })} placeholder="15" />
      </label>
      <label>Paste questions
        <textarea rows={14} value={form.raw} onChange={(e) => setForm({ ...form, raw: e.target.value })} placeholder={'1. Question text?\nA. Option\nB. Option\nC. Option\nD. Option\nAnswer: B\nExplanation: Why B.'} />
      </label>

      {form.raw.trim() && (
        <div className="stack tight">
          <p><strong>{parsed.questions.length}</strong> questions parsed{parsed.errors.length ? `, ${parsed.errors.length} with problems` : ''}</p>
          {parsed.errors.map((er, k) => <p key={k} className="error small">{er}</p>)}
          {parsed.questions.map((q, n) => (
            <div key={n} className="card review">
              <p className="qtext">{n + 1}. {q.text}</p>
              {q.options.map((o, k) => (
                <p key={k} className={k === q.answer ? 'right' : 'muted'}>{LETTERS[k]}. {o}</p>
              ))}
              {q.explanation && <p className="muted small">{q.explanation}</p>}
            </div>
          ))}
        </div>
      )}

      {msg && <p className={msg.startsWith('Published') ? 'right' : 'error'}>{msg}</p>}
      <button className="btn" disabled={!canPublish} onClick={publish}>{busy ? 'Publishing...' : 'Publish quiz'}</button>

      <h2>Your quizzes</h2>
      {!quizzes.length && <p className="muted">Nothing yet.</p>}
      {quizzes.map((q) => (
        <div key={q.id} className="card stack tight">
          <strong>{q.title}</strong>
          <span className="meta">
            {q.course || 'No course'}, {q.questionCount} questions, {q.time_limit_minutes ? `${q.time_limit_minutes} min` : 'no timer'}, {q.submissionCount} attempts, {q.published ? 'live' : 'hidden'}
          </span>
          <div className="row">
            <a className="btn ghost" href={`/quiz/${q.slug}`} target="_blank" rel="noreferrer">Open</a>
            <button className="btn ghost" onClick={() => navigator.clipboard.writeText(`${window.location.origin}/quiz/${q.slug}`)}>Copy link</button>
            <button className="btn ghost" onClick={() => setTime(q)}>Set time</button>
            {q.course && <button className="btn ghost" onClick={() => copyTop(q)}>Copy top 10 post</button>}
            <button className="btn ghost" onClick={() => toggle(q)}>{q.published ? 'Hide' : 'Show'}</button>
            <button className="btn ghost" onClick={() => remove(q)}>Delete</button>
          </div>
        </div>
      ))}
    </div>
  );
}
