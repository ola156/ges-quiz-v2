'use client';
import { useEffect, useMemo, useState } from 'react';
import { parseStudy, serializeStudy, STUDY_PROMPT } from '../lib/studyparse';
import { splitLessons } from '../lib/studybulk';
import { SCHOOLS } from '../lib/schools';
import Rich from './Rich';
import { plainMath } from './MathParts';

const LEVELS = [
  { id: 'jamb', label: 'JAMB' },
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

  // Bulk import: read files, check them here first, then send a few lessons at a time.
  const [bulk, setBulk] = useState({ lessons: [], errors: [] });
  const [bulkHidden, setBulkHidden] = useState(true);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkLog, setBulkLog] = useState(null);

  async function chooseFiles(e) {
    const files = [...(e.target.files || [])];
    e.target.value = '';
    const lessons = [];
    const errors = [];
    for (const file of files) {
      if (file.size > 3000000) { errors.push(`${file.name}: file is too big`); continue; }
      const r = splitLessons(await file.text());
      errors.push(...r.errors.map((x) => `${file.name}: ${x}`));
      for (const l of r.lessons) {
        const p = parseStudy(l.content);
        lessons.push({ ...l, file: file.name, cards: p.cards.length, qs: p.questions.length, problem: p.errors[0] || (!p.cards.length ? 'No cards' : '') });
      }
    }
    setBulk({ lessons, errors });
    setBulkLog(null);
  }

  async function runBulk() {
    setBulkBusy(true);
    setErr('');
    const log = { added: 0, skipped: 0, failed: 0, lessonIds: [], subjectIds: [], notes: [] };
    for (let i = 0; i < bulk.lessons.length; i += 10) {
      const chunk = bulk.lessons.slice(i, i + 10).map(({ exam, subject, topic, title, content }) => ({ exam, subject, topic, title, content }));
      const res = await fetch('/api/admin/study', { method: 'POST', headers, body: JSON.stringify({ action: 'bulk', published: !bulkHidden, lessons: chunk }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { log.notes.push(data.error || 'A batch could not be saved. Run the import again to continue, lessons already added are skipped.'); break; }
      for (const r of data.results || []) {
        if (r.status === 'added') { log.added += 1; log.lessonIds.push(r.id); }
        else if (r.status === 'skipped') log.skipped += 1;
        else { log.failed += 1; log.notes.push(`${r.topic}, ${r.title}: ${r.message}`); }
      }
      for (const id of data.subjectIds || []) if (!log.subjectIds.includes(id)) log.subjectIds.push(id);
    }
    setBulkBusy(false);
    setBulkLog(log);
    if (!log.failed && !log.notes.length) setBulk({ lessons: [], errors: [] });
    await load();
  }

  async function showImported() {
    if (!bulkLog) return;
    const ok = await call('POST', { action: 'show', lessonIds: bulkLog.lessonIds, subjectIds: bulkLog.subjectIds }, 'Lessons are now visible to students');
    if (ok) setBulkLog({ ...bulkLog, shown: true });
  }

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
    if (!window.confirm(`Delete ${plainMath(label)}? This cannot be undone.`)) return;
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
            {forLevel.map((s) => <option key={s.dbId} value={s.dbId}>{plainMath(s.name)}</option>)}
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
            {(subject?.topics || []).map((t) => <option key={t.id} value={t.id}>{plainMath(t.title)}</option>)}
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
        {parsed && !parsed.errors.length && (
          <details className="stack tight">
            <summary>Preview how students will see it</summary>
            <div className="stack tight" style={{ paddingTop: 8 }}>
              {f.title.trim() && <h3 className="card-h"><Rich text={f.title} /></h3>}
              {parsed.cards.map((c, i) => (
                <div key={i} className="card stack tight">
                  <h4 className="card-h"><Rich text={c.t} /></h4>
                  <ul style={{ margin: 0, paddingLeft: 20, display: 'grid', gap: 6, lineHeight: 1.55 }}>
                    {c.p.map((line, j) => <li key={j}><Rich text={line} /></li>)}
                  </ul>
                </div>
              ))}
              {parsed.questions.map((q, i) => (
                <div key={i} className="card stack tight">
                  <p className="qtext"><b>{i + 1}.</b> <Rich text={q.q} /></p>
                  {q.o.map((o, k) => (
                    <p key={k} className="small" style={{ margin: 0, fontWeight: k === q.a ? 700 : 400 }}>{'ABCD'[k]}. <Rich text={o} />{k === q.a ? ' (correct)' : ''}</p>
                  ))}
                  {q.why && <p className="small muted">Why: <Rich text={q.why} /></p>}
                </div>
              ))}
            </div>
          </details>
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

      <section className="card stack tight">
        <strong>Bulk import</strong>
        <p className="hint">Choose one or more lesson files. Each lesson in them starts with an === LESSON === line. Everything is checked here first, and nothing is saved until you press Import. Lessons already in a topic are skipped, so importing the same file twice is safe.</p>
        <label className="btn sm ghost" style={{ justifySelf: 'start' }}>
          Choose files
          <input type="file" accept=".txt,text/plain" multiple hidden onChange={chooseFiles} />
        </label>

        {bulk.errors.map((x, i) => <p key={i} className="error small">{x}</p>)}
        {bulk.lessons.length > 0 && (() => {
          const bad = bulk.lessons.filter((l) => l.problem);
          const topics = new Set(bulk.lessons.map((l) => `${l.subject}|${l.topic}`)).size;
          return (
            <>
              <p className={bad.length ? 'error small' : 'hint'}>
                {bulk.lessons.length} lessons in {topics} topics, {bulk.lessons.reduce((n, l) => n + l.cards, 0)} cards, {bulk.lessons.reduce((n, l) => n + l.qs, 0)} questions.
                {bad.length ? ` ${bad.length} need fixing before you can import.` : ''}
              </p>
              {bad.slice(0, 8).map((l, i) => <p key={i} className="error small">{l.topic}, {l.title}: {l.problem}</p>)}
              <details>
                <summary>See the lessons</summary>
                <div className="stack tight" style={{ paddingTop: 8 }}>
                  {bulk.lessons.map((l, i) => (
                    <p key={i} className="small" style={{ margin: 0 }}>{l.topic}: {l.title} <span className="muted">{l.cards} cards, {l.qs} questions</span></p>
                  ))}
                </div>
              </details>
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <input type="checkbox" checked={bulkHidden} onChange={(e) => setBulkHidden(e.target.checked)} style={{ width: 'auto', marginTop: 4 }} />
                <span>Save as hidden <span className="hint" style={{ display: 'block' }}>Students will not see them until you press Show. Recommended, so you can read them first.</span></span>
              </label>
              <div className="row">
                <button type="button" className="btn" disabled={bulkBusy || bad.length > 0} onClick={runBulk}>{bulkBusy ? 'Importing...' : `Import ${bulk.lessons.length} lessons`}</button>
                <button type="button" className="btn ghost" disabled={bulkBusy} onClick={() => setBulk({ lessons: [], errors: [] })}>Clear</button>
              </div>
            </>
          );
        })()}

        {bulkLog && (
          <div className="stack tight">
            <p className="hint">Added {bulkLog.added}. Skipped {bulkLog.skipped} that were already there. {bulkLog.failed ? `${bulkLog.failed} could not be saved.` : ''}</p>
            {bulkLog.notes.slice(0, 8).map((x, i) => <p key={i} className="error small">{x}</p>)}
            {bulkLog.added > 0 && bulkHidden && !bulkLog.shown && (
              <div className="row">
                <button type="button" className="btn sm" disabled={busy} onClick={showImported}>Show these {bulkLog.added} lessons to students</button>
              </div>
            )}
            {bulkLog.shown && <p className="hint">They are now visible to students.</p>}
          </div>
        )}
        {err && <p className="error">{err}</p>}
      </section>

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
              <strong><Rich text={s.name} /></strong>
              <p className="muted small">{levelName(s.exam)}{s.school ? `, ${SCHOOLS.find((x) => x.id === s.school)?.short || s.school}` : schoolLevelName(s.exam)}{s.published ? '' : ', hidden'}</p>
            </div>
            <div className="row">
              <button type="button" className="btn sm ghost" disabled={busy} onClick={() => call('PATCH', { kind: 'subject', id: s.dbId, published: !s.published })}>{s.published ? 'Hide' : 'Show'}</button>
              <button type="button" className="btn sm ghost" disabled={busy} onClick={() => remove('subject', s.dbId, `${s.name} and all its lessons`)}>Delete</button>
            </div>
          </div>
          {s.topics.map((t) => (
            <details key={t.id}>
              <summary><strong><Rich text={t.title} /></strong> <span className="muted small">{t.subtopics.length} lessons</span></summary>
              <div className="stack tight" style={{ paddingTop: 8 }}>
                {t.subtopics.map((sub) => (
                  <div key={sub.id} className="tutor-row">
                    <div>
                      <span><Rich text={sub.title} /></span>
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