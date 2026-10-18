'use client';
import { useEffect, useMemo, useState } from 'react';
import { parseStudy, serializeStudy, STUDY_PROMPT } from '../lib/studyparse';
import { SCHOOLS } from '../lib/schools';

const LEVELS = [
  { id: 'jamb', label: 'JAMB' },
  { id: 'waec', label: 'WAEC' },
  { id: 'post_utme', label: 'Post-UTME' },
  { id: 'university', label: 'University' },
];
const levelName = (id) => LEVELS.find((l) => l.id === id)?.label || id;
const EMPTY = { exam: 'jamb', school: '', subjectId: '', subjectName: '', subjectBlurb: '', topicId: '', topicTitle: '', title: '', content: '', subtopicId: '' };

// mode 'form' is where lessons are written. mode 'list' shows what has been made. Kept apart on purpose.
export default function AdminStudy({ pw, flash, mode, onMode }) {
  const [subjects, setSubjects] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [f, setF] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [showPrompt, setShowPrompt] = useState(false);
  const headers = { 'Content-Type': 'application/json', 'x-admin-password': pw };

  async function load() {
    const res = await fetch('/api/admin/study', { headers });
    const data = await res.json().catch(() => ({}));
    if (res.ok) setSubjects(data.subjects || []);
    else setErr(data.error || 'Could not load study content');
    setLoaded(true);
  }
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function call(method, payload, okText) {
    setBusy(true);
    setErr('');
    const res = await fetch('/api/admin/study', { method, headers, body: JSON.stringify(payload) });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setErr(data.error || 'Something went wrong'); return false; }
    if (okText) flash(okText);
    await load();
    return true;
  }

  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const parsed = useMemo(() => (f.content.trim() ? parseStudy(f.content) : null), [f.content]);
  const forLevel = subjects.filter((s) => s.exam === f.exam && (s.school || '') === (f.school || ''));
  const subject = subjects.find((s) => s.dbId === f.subjectId);
  const schoolLevel = f.exam === 'post_utme' || f.exam === 'university';
  const hasChem = subjects.some((s) => s.exam === 'jamb' && s.id === 'chemistry');

  async function save() {
    const ok = await call('POST', { action: 'save', ...f }, f.subtopicId ? 'Lesson updated' : 'Lesson saved');
    if (ok) setF((p) => ({ ...EMPTY, exam: p.exam, school: p.school, subjectId: p.subjectId, topicId: p.topicId }));
  }

  function edit(s, t, sub) {
    setF({
      exam: s.exam, school: s.school || '', subjectId: s.dbId, subjectName: '', subjectBlurb: '',
      topicId: t.id, topicTitle: '', title: sub.title, subtopicId: sub.id,
      content: serializeStudy(sub.cards, sub.questions),
    });
    onMode('form');
  }

  async function remove(kind, id, label) {
    if (!window.confirm(`Delete ${label}? This cannot be undone.`)) return;
    await call('DELETE', { kind, id }, 'Deleted');
  }

  const ready = f.title.trim() && f.content.trim() && parsed && !parsed.errors.length
    && (f.subjectId || f.subjectName.trim()) && (f.topicId || f.topicTitle.trim());

  if (mode === 'form') {
    return (
      <>
        <div className="row between">
          <span className="muted small">{subjects.length} {subjects.length === 1 ? 'subject' : 'subjects'} so far</span>
          <button type="button" className="btn sm ghost" onClick={() => onMode('list')}>View study content</button>
        </div>
      <section className="card stack">
        <h2 className="sec-title">{f.subtopicId ? 'Edit lesson' : 'Add a lesson'}</h2>
        <p className="hint">A lesson is a few study cards and a short quiz. Pick the level, then the subject and topic.</p>
        <div className="row">
          <label className="field">Level
            <select value={f.exam} disabled={Boolean(f.subtopicId)} onChange={(e) => setF({ ...f, exam: e.target.value, school: '', subjectId: '', topicId: '' })}>
              {LEVELS.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
            </select>
          </label>
          {schoolLevel && (
            <label className="field">School
              <select value={f.school} disabled={Boolean(f.subtopicId)} onChange={(e) => setF({ ...f, school: e.target.value, subjectId: '', topicId: '' })}>
                <option value="">All schools</option>
                {SCHOOLS.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </label>
          )}
        </div>

        <label className="field">Subject
          <select value={f.subjectId} disabled={Boolean(f.subtopicId)} onChange={(e) => setF({ ...f, subjectId: e.target.value, topicId: '' })}>
            <option value="">New subject</option>
            {forLevel.map((s) => <option key={s.dbId} value={s.dbId}>{s.name}</option>)}
          </select>
        </label>
        {!f.subjectId && (
          <>
            <label className="field">New subject name
              <input value={f.subjectName} onChange={(e) => set('subjectName', e.target.value)} placeholder="Physics" />
            </label>
            <label className="field">One line about it (optional)
              <input value={f.subjectBlurb} onChange={(e) => set('subjectBlurb', e.target.value)} />
            </label>
          </>
        )}

        <label className="field">Topic
          <select value={f.topicId} disabled={Boolean(f.subtopicId)} onChange={(e) => set('topicId', e.target.value)}>
            <option value="">New topic</option>
            {(subject?.topics || []).map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
          </select>
        </label>
        {!f.topicId && (
          <label className="field">New topic name
            <input value={f.topicTitle} onChange={(e) => set('topicTitle', e.target.value)} placeholder="Mechanics" />
          </label>
        )}

        <label className="field">Lesson title
          <input value={f.title} onChange={(e) => set('title', e.target.value)} placeholder="Newton's laws of motion" />
        </label>

        <label className="field">Cards and quiz
          <textarea rows={16} value={f.content} onChange={(e) => set('content', e.target.value)}
            placeholder={'## Card title\n- First point\n- Second point\n\nQUIZ\n1. Question\nA. option\nB. option\nC. option\nD. option\nAnswer: B\nExplanation: why'} />
        </label>

        {parsed && (
          <p className={parsed.errors.length ? 'error' : 'hint'}>
            {parsed.errors.length ? parsed.errors[0] : `${parsed.cards.length} cards, ${parsed.questions.length} questions`}
          </p>
        )}
        {err && <p className="error">{err}</p>}

        <div className="row">
          <button type="button" className="btn" disabled={!ready || busy} onClick={save}>{busy ? 'Saving...' : f.subtopicId ? 'Save changes' : 'Save lesson'}</button>
          {(f.subtopicId || f.content) && <button type="button" className="btn ghost" onClick={() => setF({ ...EMPTY, exam: f.exam, school: f.school })}>Clear</button>}
          <button type="button" className="btn ghost" onClick={() => setShowPrompt(!showPrompt)}>{showPrompt ? 'Hide AI prompt' : 'AI prompt'}</button>
        </div>
        {showPrompt && (
          <div className="stack tight">
            <pre className="prompt-box" style={{ whiteSpace: 'pre-wrap', fontSize: 13 }}>{STUDY_PROMPT}</pre>
            <button type="button" className="btn sm ghost" onClick={() => navigator.clipboard.writeText(STUDY_PROMPT).then(() => flash('Prompt copied')).catch(() => flash('Could not copy'))}>Copy prompt</button>
          </div>
        )}
      </section>

      </>
    );
  }

  return (
    <>
      <div className="row between">
        <span className="muted small">{subjects.reduce((n, x) => n + x.topics.reduce((m, t) => m + t.subtopics.length, 0), 0)} lessons</span>
        <button type="button" className="btn sm" onClick={() => { setF({ ...EMPTY }); onMode('form'); }}>New lesson</button>
      </div>

      {loaded && !hasChem && (
        <section className="card stack tight">
          <strong>JAMB Chemistry</strong>
          <p className="hint">The built in Chemistry lessons are not in the database yet. Import them once so you can edit them here. Student progress is kept.</p>
          <button type="button" className="btn sm" disabled={busy} onClick={() => call('POST', { action: 'seed' }, 'Imported')}>Import JAMB Chemistry</button>
        </section>
      )}

      {loaded && !subjects.length && <p className="muted">No study content yet.</p>}
      {subjects.map((s) => (
        <section key={s.dbId} className="card stack tight">
          <div className="tutor-row">
            <div>
              <strong>{s.name}</strong>
              <p className="muted small">{levelName(s.exam)}{s.school ? `, ${SCHOOLS.find((x) => x.id === s.school)?.short || s.school}` : schoolLevelName(s.exam)}{s.published ? '' : ', hidden'}</p>
            </div>
            <div className="row">
              <button type="button" className="btn sm ghost" disabled={busy} onClick={() => call('PATCH', { kind: 'subject', id: s.dbId, published: !s.published })}>{s.published ? 'Hide' : 'Show'}</button>
              <button type="button" className="btn sm ghost" disabled={busy} onClick={() => remove('subject', s.dbId, `${s.name} and all its lessons`)}>Delete</button>
            </div>
          </div>
          {s.topics.map((t) => (
            <details key={t.id}>
              <summary><strong>{t.title}</strong> <span className="muted small">{t.subtopics.length} lessons</span></summary>
              <div className="stack tight" style={{ paddingTop: 8 }}>
                {t.subtopics.map((sub) => (
                  <div key={sub.id} className="tutor-row">
                    <div>
                      <span>{sub.title}</span>
                      <p className="muted small">{sub.cards.length} cards, {sub.questions.length} questions{sub.published ? '' : ', hidden'}</p>
                    </div>
                    <div className="row">
                      <button type="button" className="btn sm ghost" onClick={() => edit(s, t, sub)}>Edit</button>
                      <button type="button" className="btn sm ghost" disabled={busy} onClick={() => call('PATCH', { kind: 'subtopic', id: sub.id, published: !sub.published })}>{sub.published ? 'Hide' : 'Show'}</button>
                      <button type="button" className="btn sm ghost" disabled={busy} onClick={() => remove('subtopic', sub.id, sub.title)}>Delete</button>
                    </div>
                  </div>
                ))}
                <div className="row">
                  <button type="button" className="btn sm ghost" onClick={() => remove('topic', t.id, `${t.title} and its lessons`)}>Delete topic</button>
                </div>
              </div>
            </details>
          ))}
        </section>
      ))}
    </>
  );
}

function schoolLevelName(exam) {
  return exam === 'post_utme' || exam === 'university' ? ', all schools' : '';
}