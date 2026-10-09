'use client';
import { useEffect, useMemo, useState } from 'react';
import { parseQuestions, AI_PROMPT } from '../../lib/parse';

const LETTERS = ['A', 'B', 'C', 'D', 'E'];
const EMPTY = { title: '', course: '', description: '', timeLimit: '', raw: '' };
const EMPTY_CREATOR = { name: '', post: '', agenda: '', photo_url: '', logo_url: '' };

// Shrinks a picture in the browser so quizzes stay fast on mobile data.
// Photos and question pictures become JPEG (max 1200px, under ~300 KB). Logos stay PNG (max 400px).
async function shrink(file, { max = 1200, png = false } = {}) {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const w = Math.max(1, Math.round(bmp.width * scale));
  const h = Math.max(1, Math.round(bmp.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!png) { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h); }
  ctx.drawImage(bmp, 0, 0, w, h);
  const type = png ? 'image/png' : 'image/jpeg';
  let quality = 0.85;
  let blob = null;
  for (let k = 0; k < 6; k++) {
    blob = await new Promise((r) => canvas.toBlob(r, type, quality));
    if (png || !blob || blob.size <= 300 * 1024) break;
    quality -= 0.12;
  }
  return blob;
}

export default function Admin() {
  const [pw, setPw] = useState('');
  const [authed, setAuthed] = useState(false);
  const [view, setView] = useState('add'); // add | manage
  const [quizzes, setQuizzes] = useState([]);
  const [creators, setCreators] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [kind, setKind] = useState('public'); // public | private
  const [creatorId, setCreatorId] = useState('');
  const [images, setImages] = useState({}); // question number -> image address
  const [uploading, setUploading] = useState(null);
  const [newCreator, setNewCreator] = useState(EMPTY_CREATOR);
  const [creatorMsg, setCreatorMsg] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null); // last published { slug, listed }
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all'); // all | public | private | hidden
  const [toast, setToast] = useState('');

  const parsed = useMemo(() => parseQuestions(form.raw), [form.raw]);
  const headers = { 'Content-Type': 'application/json', 'x-admin-password': pw };
  const isPrivate = kind === 'private';

  // Search and filter, then group public quizzes by course and keep private sets together.
  const shown = useMemo(() => {
    const s = search.trim().toLowerCase();
    return quizzes.filter((q) => {
      const priv = q.listed === false;
      if (filter === 'public' && priv) return false;
      if (filter === 'private' && !priv) return false;
      if (filter === 'hidden' && q.published) return false;
      if (!s) return true;
      return [q.title, q.course, q.slug, q.creators?.name].some((v) => String(v || '').toLowerCase().includes(s));
    });
  }, [quizzes, search, filter]);

  const groups = useMemo(() => {
    const m = new Map();
    for (const q of shown) {
      const g = q.listed === false ? 'Private sets' : q.course?.trim() || 'No course';
      if (!m.has(g)) m.set(g, []);
      m.get(g).push(q);
    }
    return [...m.entries()].sort(([a], [b]) => (a === 'Private sets' ? 1 : b === 'Private sets' ? -1 : a.localeCompare(b)));
  }, [shown]);

  const counts = useMemo(() => ({
    all: quizzes.length,
    public: quizzes.filter((q) => q.listed !== false).length,
    private: quizzes.filter((q) => q.listed === false).length,
    hidden: quizzes.filter((q) => !q.published).length,
    attempts: quizzes.reduce((n, q) => n + (q.submissionCount || 0), 0),
  }), [quizzes]);

  function flash(text) {
    setToast(text);
    setTimeout(() => setToast(''), 1800);
  }

  function copy(text, label = 'Copied') {
    navigator.clipboard.writeText(text).then(() => flash(label)).catch(() => flash('Could not copy'));
  }

  async function load(password = pw) {
    const res = await fetch('/api/admin/quizzes', { headers: { 'x-admin-password': password } });
    if (res.status === 401) { setAuthed(false); setMsg('Wrong password'); return false; }
    const data = await res.json();
    setQuizzes(data.quizzes || []);
    setAuthed(true);
    setMsg('');
    loadCreators(password);
    return true;
  }

  async function loadCreators(password = pw) {
    const res = await fetch('/api/admin/creators', { headers: { 'x-admin-password': password } });
    if (res.ok) setCreators((await res.json()).creators || []);
  }

  useEffect(() => {
    const saved = sessionStorage.getItem('adminpw');
    if (saved) { setPw(saved); load(saved); }
  }, []);

  async function login(e) {
    e.preventDefault();
    if (await load()) sessionStorage.setItem('adminpw', pw);
  }

  // Resize in the browser, then upload. Returns the public address.
  async function uploadImage(file, folder, opts) {
    const blob = await shrink(file, opts);
    if (!blob) throw new Error('Could not read that image');
    const fd = new FormData();
    fd.append('file', new File([blob], 'image', { type: blob.type }));
    fd.append('folder', folder);
    const res = await fetch('/api/admin/upload', { method: 'POST', headers: { 'x-admin-password': pw }, body: fd });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Upload failed');
    return data.url;
  }

  async function attachQuestionImage(n, file) {
    if (!file) return;
    setUploading(n);
    setMsg('');
    try {
      const url = await uploadImage(file, 'questions');
      setImages((prev) => ({ ...prev, [n]: url }));
    } catch (err) {
      setMsg(err.message);
    }
    setUploading(null);
  }

  async function attachCreatorImage(field, file) {
    if (!file) return;
    setCreatorMsg('Uploading...');
    try {
      const url = await uploadImage(file, 'creators', field === 'logo_url' ? { max: 400, png: true } : { max: 600 });
      setNewCreator((c) => ({ ...c, [field]: url }));
      setCreatorMsg('');
    } catch (err) {
      setCreatorMsg(err.message);
    }
  }

  async function saveCreator() {
    setCreatorMsg('');
    const res = await fetch('/api/admin/creators', { method: 'POST', headers, body: JSON.stringify(newCreator) });
    const data = await res.json();
    if (!res.ok) return setCreatorMsg(data.error || 'Could not save');
    setNewCreator(EMPTY_CREATOR);
    await loadCreators();
    setCreatorId(data.creator.id);
    setCreatorMsg(`Saved ${data.creator.name}. They are selected for this set.`);
  }

  async function removeCreator() {
    const c = creators.find((x) => x.id === creatorId);
    if (!c || !confirm(`Delete creator "${c.name}"? Their sets stay, but the creator card disappears.`)) return;
    await fetch('/api/admin/creators', { method: 'DELETE', headers, body: JSON.stringify({ id: c.id }) });
    setCreatorId('');
    loadCreators();
  }

  async function publish() {
    setBusy(true); setMsg(''); setDone(null);
    const res = await fetch('/api/admin/quizzes', {
      method: 'POST', headers,
      body: JSON.stringify({
        kind, creatorId: isPrivate ? creatorId : '',
        title: form.title, course: isPrivate ? '' : form.course, description: form.description,
        timeLimit: form.timeLimit,
        questions: parsed.questions.map((q, n) => ({ ...q, image_url: images[n + 1] || null })),
      }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) return setMsg(data.error || 'Failed to publish');
    setDone({ slug: data.slug, listed: data.listed !== false });
    setForm(EMPTY);
    setImages({});
    window.scrollTo({ top: 0, behavior: 'smooth' });
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
    copy(data.text, 'Top 10 post copied');
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
        <div className="card stack tight">
          <label>Password
            <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} />
          </label>
          {msg && <p className="error small">{msg}</p>}
          <button className="btn">Log in</button>
        </div>
      </form>
    );

  const canPublish = form.title.trim() && parsed.questions.length && !busy && uploading === null;
  const chosenCreator = creators.find((c) => c.id === creatorId);
  const origin = typeof window !== 'undefined' ? window.location.origin : '';

  function renderQuiz(q) {
    const priv = q.listed === false;
    const link = `${origin}/quiz/${q.slug}`;
    return (
      <div key={q.id} className={`card qitem ${q.published ? '' : 'off'}`}>
        <div className="qitem-top">
          <strong className="qitem-title">{q.title}</strong>
          <span className={`badge ${priv ? 'private' : 'public'}`}>{priv ? 'PRIVATE' : 'PUBLIC'}</span>
        </div>
        <div className="chips">
          <span className="chip">{q.questionCount} questions</span>
          <span className="chip">{q.time_limit_minutes ? `${q.time_limit_minutes} min` : 'No timer'}</span>
          <span className="chip">{q.submissionCount} attempts</span>
          {!q.published && <span className="chip off">Hidden</span>}
          {priv && q.creators?.name && <span className="chip">{q.creators.name}</span>}
        </div>
        {priv && (
          <button type="button" className="code-pill" onClick={() => copy(q.slug, 'Code copied')} title="Tap to copy the code">
            <span>Code</span><strong>{q.slug}</strong>
          </button>
        )}
        <div className="row actions">
          <a className="btn sm" href={`/quiz/${q.slug}`} target="_blank" rel="noreferrer">Open</a>
          <button className="btn sm ghost" onClick={() => copy(link, 'Link copied')}>Copy link</button>
          <button className="btn sm ghost" onClick={() => toggle(q)}>{q.published ? 'Hide' : 'Show'}</button>
          <details className="more">
            <summary className="btn sm ghost">More</summary>
            <div className="more-menu">
              <button className="btn sm ghost" onClick={() => setTime(q)}>Set time</button>
              {q.course && !priv && <button className="btn sm ghost" onClick={() => copyTop(q)}>Copy top 10 post</button>}
              <button className="btn sm danger" onClick={() => remove(q)}>Delete</button>
            </div>
          </details>
        </div>
      </div>
    );
  }

  return (
    <div className="stack">
      <h1>Admin</h1>

      <div className="seg">
        <button type="button" className={`seg-btn ${view === 'add' ? 'on' : ''}`} onClick={() => setView('add')}>Add a quiz</button>
        <button type="button" className={`seg-btn ${view === 'manage' ? 'on' : ''}`} onClick={() => setView('manage')}>
          Manage <span className="seg-count">{counts.all}</span>
        </button>
      </div>

      {view === 'add' && (
        <>
          {done && (
            <div className="card done stack tight">
              <strong className="done-title">{done.listed ? 'Public quiz published' : 'Private set published'}</strong>
              {!done.listed && (
                <button type="button" className="code-pill big" onClick={() => copy(done.slug, 'Code copied')}>
                  <span>Code</span><strong>{done.slug}</strong>
                </button>
              )}
              <div className="row">
                <button className="btn sm" onClick={() => copy(`${origin}/quiz/${done.slug}`, 'Link copied')}>Copy link</button>
                <a className="btn sm ghost" href={`/quiz/${done.slug}`} target="_blank" rel="noreferrer">Open</a>
                <button className="btn sm ghost" onClick={() => setDone(null)}>Dismiss</button>
              </div>
            </div>
          )}

          <section className="card stack">
            <h2 className="sec-title"><span className="step">1</span>Type</h2>
            <div className="kind">
              <button type="button" className={`kind-btn ${!isPrivate ? 'on' : ''}`} onClick={() => setKind('public')}>
                <strong>Public quiz</strong>
                <span>Listed on the home page. Counts on leaderboards.</span>
              </button>
              <button type="button" className={`kind-btn ${isPrivate ? 'on' : ''}`} onClick={() => setKind('private')}>
                <strong>Private set</strong>
                <span>Hidden. Opens with a code or link only.</span>
              </button>
            </div>
            <p className={`kind-banner ${kind}`}>
              {isPrivate
                ? 'PRIVATE: it will not appear anywhere on the site. Share the code or link yourself.'
                : 'PUBLIC: everyone will see it on the home page.'}
            </p>
          </section>

          <section className="card stack">
            <h2 className="sec-title"><span className="step">2</span>Details</h2>
            <label>Title
              <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder={isPrivate ? 'Know your candidate' : 'GES 101 Set A'} />
            </label>

            {!isPrivate && (
              <label>Course
                <input value={form.course} onChange={(e) => setForm({ ...form, course: e.target.value })} placeholder="GES 101" />
                <span className="hint">Sets with the same course name share one overall leaderboard.</span>
              </label>
            )}

            <div className="grid2">
              <label>Description <span className="opt-tag">optional</span>
                <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Chapters 1 to 3" />
              </label>
              <label>Time limit (min) <span className="opt-tag">optional</span>
                <input type="number" min="1" max="300" inputMode="numeric" value={form.timeLimit} onChange={(e) => setForm({ ...form, timeLimit: e.target.value })} placeholder="15" />
              </label>
            </div>

            {isPrivate && (
              <div className="subcard stack tight">
                <label>Creator card <span className="opt-tag">optional</span>
                  <select value={creatorId} onChange={(e) => setCreatorId(e.target.value)}>
                    <option value="">No creator card</option>
                    {creators.map((c) => <option key={c.id} value={c.id}>{c.name}{c.post ? `, ${c.post}` : ''}</option>)}
                  </select>
                  <span className="hint">Shown to students as "Presented by" above Start quiz.</span>
                </label>

                {chosenCreator && (
                  <div className="creator-pick">
                    {chosenCreator.photo_url
                      ? <img className="thumb round" src={chosenCreator.photo_url} alt="" />
                      : <span className="avatar">{chosenCreator.name.slice(0, 1).toUpperCase()}</span>}
                    <div className="creator-pick-who">
                      <strong>{chosenCreator.name}</strong>
                      {chosenCreator.post && <span className="hint">{chosenCreator.post}</span>}
                    </div>
                    {chosenCreator.logo_url && <img className="thumb" src={chosenCreator.logo_url} alt="" />}
                    <button type="button" className="btn sm danger" onClick={removeCreator}>Delete</button>
                  </div>
                )}

                <details className="fold">
                  <summary>+ Add a new creator</summary>
                  <div className="stack tight fold-body">
                    <label>Name
                      <input value={newCreator.name} onChange={(e) => setNewCreator({ ...newCreator, name: e.target.value })} />
                    </label>
                    <label>Post being contested <span className="opt-tag">optional</span>
                      <input value={newCreator.post} onChange={(e) => setNewCreator({ ...newCreator, post: e.target.value })} placeholder="Course rep, SUG President..." />
                    </label>
                    <label>Agenda <span className="opt-tag">optional</span>
                      <textarea rows={4} value={newCreator.agenda} onChange={(e) => setNewCreator({ ...newCreator, agenda: e.target.value })} />
                    </label>
                    <div className="grid2">
                      <div className="upload">
                        <span className="upload-label">Photo <span className="opt-tag">optional</span></span>
                        <div className="upload-row">
                          {newCreator.photo_url && <img className="thumb round" src={newCreator.photo_url} alt="" />}
                          <label className="btn sm ghost">
                            {newCreator.photo_url ? 'Change' : 'Choose photo'}
                            <input type="file" accept="image/*" hidden onChange={(e) => { attachCreatorImage('photo_url', e.target.files?.[0]); e.target.value = ''; }} />
                          </label>
                          {newCreator.photo_url && <button type="button" className="btn sm ghost" onClick={() => setNewCreator({ ...newCreator, photo_url: '' })}>Remove</button>}
                        </div>
                      </div>
                      <div className="upload">
                        <span className="upload-label">Logo <span className="opt-tag">optional</span></span>
                        <div className="upload-row">
                          {newCreator.logo_url && <img className="thumb" src={newCreator.logo_url} alt="" />}
                          <label className="btn sm ghost">
                            {newCreator.logo_url ? 'Change' : 'Choose logo'}
                            <input type="file" accept="image/*" hidden onChange={(e) => { attachCreatorImage('logo_url', e.target.files?.[0]); e.target.value = ''; }} />
                          </label>
                          {newCreator.logo_url && <button type="button" className="btn sm ghost" onClick={() => setNewCreator({ ...newCreator, logo_url: '' })}>Remove</button>}
                        </div>
                      </div>
                    </div>
                    {creatorMsg && <p className="hint">{creatorMsg}</p>}
                    <button type="button" className="btn sm" disabled={!newCreator.name.trim()} onClick={saveCreator}>Save creator</button>
                    <p className="hint">Only the name is required. Use only photos and logos the creator gave you. For an election, check your school's campaign rules first.</p>
                  </div>
                </details>
              </div>
            )}
          </section>

          <section className="card stack">
            <h2 className="sec-title"><span className="step">3</span>Questions</h2>
            <details className="fold">
              <summary>AI prompt (copy this with your slides)</summary>
              <div className="stack tight fold-body">
                <pre className="prompt">{AI_PROMPT}</pre>
                <button type="button" className="btn sm ghost" onClick={() => copy(AI_PROMPT, 'Prompt copied')}>Copy prompt</button>
              </div>
            </details>
            <label>Paste questions
              <textarea rows={12} value={form.raw} onChange={(e) => setForm({ ...form, raw: e.target.value })} placeholder={'1. Question text?\nA. Option\nB. Option\nC. Option\nD. Option\nAnswer: B\nExplanation: Why B.'} />
            </label>
          </section>

          {form.raw.trim() && (
            <section className="stack tight">
              <div className="row between">
                <h2 className="plain">Preview</h2>
                <div className="chips">
                  <span className="chip">{parsed.questions.length} parsed</span>
                  {parsed.errors.length > 0 && <span className="chip bad">{parsed.errors.length} problems</span>}
                </div>
              </div>
              {parsed.errors.map((er, k) => <p key={k} className="error small">{er}</p>)}
              <p className="muted small">Pictures are optional. They attach by question number, so recheck them if you edit the pasted text.</p>
              {parsed.questions.map((q, n) => (
                <div key={n} className="card review qprev">
                  <div className="qprev-head">
                    <span className="qnum">{n + 1}</span>
                    <p className="qtext">{q.text}</p>
                  </div>
                  {images[n + 1] && <img className="qimg" src={images[n + 1]} alt="" />}
                  <div className="qopts">
                    {q.options.map((o, k) => (
                      <p key={k} className={`qopt ${k === q.answer ? 'correct' : ''}`}><b>{LETTERS[k]}</b> {o}</p>
                    ))}
                  </div>
                  {q.explanation && <p className="hint">Why: {q.explanation}</p>}
                  <div className="row">
                    <label className="btn sm ghost">
                      {uploading === n + 1 ? 'Uploading...' : images[n + 1] ? 'Change image' : 'Add image (optional)'}
                      <input type="file" accept="image/*" hidden onChange={(e) => { attachQuestionImage(n + 1, e.target.files?.[0]); e.target.value = ''; }} />
                    </label>
                    {images[n + 1] && (
                      <button type="button" className="btn sm ghost" onClick={() => setImages((prev) => { const c = { ...prev }; delete c[n + 1]; return c; })}>Remove image</button>
                    )}
                  </div>
                </div>
              ))}
            </section>
          )}

          {msg && <p className="error">{msg}</p>}
          <div className="pubbar">
            <button className="btn" disabled={!canPublish} onClick={publish}>
              {busy ? 'Publishing...' : isPrivate ? 'Publish private set' : 'Publish public quiz'}
            </button>
            {!canPublish && !busy && <span className="hint-dark">Needs a title and at least one parsed question.</span>}
          </div>
        </>
      )}

      {view === 'manage' && (
        <>
          <div className="stats">
            <div className="stat"><strong>{counts.public}</strong><span>Public</span></div>
            <div className="stat"><strong>{counts.private}</strong><span>Private</span></div>
            <div className="stat"><strong>{counts.attempts}</strong><span>Attempts</span></div>
          </div>

          <div className="searchbox">
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by title, course, code or creator"
              aria-label="Search quizzes"
            />
            {search && <button type="button" className="clear" onClick={() => setSearch('')} aria-label="Clear search">×</button>}
          </div>

          <div className="filters">
            {[['all', 'All'], ['public', 'Public'], ['private', 'Private'], ['hidden', 'Hidden']].map(([key, label]) => (
              <button key={key} type="button" className={`fchip ${filter === key ? 'on' : ''}`} onClick={() => setFilter(key)}>
                {label} <span>{counts[key]}</span>
              </button>
            ))}
          </div>

          {!quizzes.length && <p className="muted">Nothing yet. Add your first quiz.</p>}
          {quizzes.length > 0 && !shown.length && <p className="muted">No quizzes match that search.</p>}

          {groups.map(([name, list]) => (
            <section key={name} className="stack tight">
              <div className="group-head">
                <h2 className="plain">{name}</h2>
                <span className="group-count">{list.length}</span>
              </div>
              {list.map((q) => renderQuiz(q))}
            </section>
          ))}
        </>
      )}

      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}