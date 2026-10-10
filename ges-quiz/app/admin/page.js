'use client';
import { useEffect, useMemo, useState } from 'react';
import { parseQuestions, AI_PROMPT } from '../../lib/parse';
import Rich from '../../components/Rich';

const LETTERS = ['A', 'B', 'C', 'D', 'E'];
// Added to the AI prompt so powers, fractions and chemical formulas come out in a form the site can draw.
const MATH_NOTE = '\n\nFor any maths, powers, fractions, roots, units or chemical formulas, write them in LaTeX between dollar signs, for example $x^2$, $\\frac{a}{b}$, $\\sqrt{x}$, $H_2O$, $5 \\times 10^{3}$, $m/s^2$, $30^\\circ$. Never use the dollar sign for money, write naira or N instead.';
const EMPTY = { title: '', course: '', description: '', timeLimit: '', raw: '' };
const EMPTY_CREATOR = { name: '', code: '', post: '', agenda: '', photo_url: '', logo_url: '' };
const EMPTY_COL = { code: '', title: '', description: '', creatorId: '' };
// While typing a code word: lowercase, spaces become hyphens, other symbols are dropped.
const typeCode = (v) => v.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

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
  const [view, setView] = useState('add'); // add | collections | manage
  const [quizzes, setQuizzes] = useState([]);
  const [creators, setCreators] = useState([]);
  const [collections, setCollections] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [kind, setKind] = useState('public'); // public | private
  const [creatorId, setCreatorId] = useState('');
  const [collectionId, setCollectionId] = useState('');
  const [allowCalc, setAllowCalc] = useState(false);
  const [images, setImages] = useState({}); // question number -> image address
  const [uploading, setUploading] = useState(null);
  const [newCreator, setNewCreator] = useState(EMPTY_CREATOR);
  const [creatorMsg, setCreatorMsg] = useState('');
  const [creatorCodes, setCreatorCodes] = useState({}); // creator id -> code being typed
  const [colForm, setColForm] = useState(EMPTY_COL);
  const [colMsg, setColMsg] = useState('');
  const [colDone, setColDone] = useState(null);
  const [editId, setEditId] = useState(null);
  const [editForm, setEditForm] = useState(EMPTY_COL);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null); // last published { slug, listed, collection }
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all'); // all | public | private | hidden
  const [toast, setToast] = useState('');

  const parsed = useMemo(() => parseQuestions(form.raw), [form.raw]);
  const headers = { 'Content-Type': 'application/json', 'x-admin-password': pw };
  const isPrivate = kind === 'private';

  // Search and filter, then group public quizzes by course, collection sets by collection, and loose private sets together.
  const shown = useMemo(() => {
    const s = search.trim().toLowerCase();
    return quizzes.filter((q) => {
      const priv = q.listed === false;
      if (filter === 'public' && priv) return false;
      if (filter === 'private' && !priv) return false;
      if (filter === 'hidden' && q.published) return false;
      if (!s) return true;
      return [q.title, q.course, q.slug, q.creators?.name, q.collections?.title, q.collections?.code]
        .some((v) => String(v || '').toLowerCase().includes(s));
    });
  }, [quizzes, search, filter]);

  const groups = useMemo(() => {
    const m = new Map();
    for (const q of shown) {
      const g = q.listed === false
        ? (q.collections?.title ? `Collection: ${q.collections.title}` : 'Private sets')
        : q.course?.trim() || 'No course';
      if (!m.has(g)) m.set(g, []);
      m.get(g).push(q);
    }
    const rank = (n) => (n === 'Private sets' ? 2 : n.startsWith('Collection: ') ? 1 : 0);
    return [...m.entries()].sort(([a], [b]) => rank(a) - rank(b) || a.localeCompare(b));
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
    loadCollections(password);
    return true;
  }

  async function loadCreators(password = pw) {
    const res = await fetch('/api/admin/creators', { headers: { 'x-admin-password': password } });
    if (res.ok) setCreators((await res.json()).creators || []);
  }

  async function loadCollections(password = pw) {
    const res = await fetch('/api/admin/collections', { headers: { 'x-admin-password': password } });
    if (res.ok) setCollections((await res.json()).collections || []);
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
    setColForm((f) => ({ ...f, creatorId: data.creator.id }));
    setCreatorMsg(`Saved ${data.creator.name}. They are selected.`);
  }

  async function removeCreator() {
    const c = creators.find((x) => x.id === creatorId);
    if (!c || !confirm(`Delete creator "${c.name}"? Their sets stay, but the creator card disappears.`)) return;
    await fetch('/api/admin/creators', { method: 'DELETE', headers, body: JSON.stringify({ id: c.id }) });
    setCreatorId('');
    loadCreators();
    loadCollections();
  }

  async function saveCreatorCode(c) {
    const code = creatorCodes[c.id] ?? c.code ?? '';
    const res = await fetch('/api/admin/creators', { method: 'PATCH', headers, body: JSON.stringify({ id: c.id, code }) });
    const data = await res.json();
    if (!res.ok) return alert(data.error || 'Could not save the code word');
    setCreatorCodes((prev) => { const n = { ...prev }; delete n[c.id]; return n; });
    flash(data.code ? 'Code word saved' : 'Code word removed');
    loadCreators();
  }

  async function createCollection() {
    setColMsg('');
    setColDone(null);
    const res = await fetch('/api/admin/collections', { method: 'POST', headers, body: JSON.stringify(colForm) });
    const data = await res.json();
    if (!res.ok) return setColMsg(data.error || 'Could not create');
    setColDone(data.collection);
    setColForm(EMPTY_COL);
    setCollectionId(data.collection.id);
    loadCollections();
  }

  function startEdit(c) {
    setEditId(c.id);
    setColMsg('');
    setEditForm({ code: c.code, title: c.title, description: c.description || '', creatorId: c.creator_id || '' });
  }

  async function saveEdit() {
    setColMsg('');
    const res = await fetch('/api/admin/collections', {
      method: 'PATCH', headers,
      body: JSON.stringify({ id: editId, code: editForm.code, title: editForm.title, description: editForm.description, creator_id: editForm.creatorId }),
    });
    const data = await res.json();
    if (!res.ok) return setColMsg(data.error || 'Could not save');
    setEditId(null);
    flash('Saved');
    loadCollections();
    load();
  }

  async function toggleCollection(c) {
    await fetch('/api/admin/collections', { method: 'PATCH', headers, body: JSON.stringify({ id: c.id, published: !c.published }) });
    loadCollections();
  }

  async function removeCollection(c) {
    if (!confirm(`Delete the collection "${c.title}"? Its sets stay as separate private sets, each with its own code. Its combined leaderboard goes away.`)) return;
    await fetch('/api/admin/collections', { method: 'DELETE', headers, body: JSON.stringify({ id: c.id }) });
    if (collectionId === c.id) setCollectionId('');
    loadCollections();
    load();
  }

  async function publish() {
    setBusy(true); setMsg(''); setDone(null);
    const res = await fetch('/api/admin/quizzes', {
      method: 'POST', headers,
      body: JSON.stringify({
        kind,
        collectionId: isPrivate ? collectionId : '',
        allowCalculator: allowCalc,
        creatorId: isPrivate && !collectionId ? creatorId : '',
        title: form.title, course: isPrivate ? '' : form.course, description: form.description,
        timeLimit: form.timeLimit,
        questions: parsed.questions.map((q, n) => ({ ...q, image_url: images[n + 1] || null })),
      }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) return setMsg(data.error || 'Failed to publish');
    setDone({ slug: data.slug, listed: data.listed !== false, collection: data.collection || null });
    setForm(EMPTY);
    setImages({});
    window.scrollTo({ top: 0, behavior: 'smooth' });
    load();
  }

  async function toggle(q) {
    await fetch('/api/admin/quizzes', { method: 'PATCH', headers, body: JSON.stringify({ id: q.id, published: !q.published }) });
    load();
  }

  async function toggleCalc(q) {
    await fetch('/api/admin/quizzes', { method: 'PATCH', headers, body: JSON.stringify({ id: q.id, allow_calculator: !q.allow_calculator }) });
    load();
  }

  async function setTime(q) {
    const v = prompt('Time limit in minutes. Leave empty for no timer.', q.time_limit_minutes || '');
    if (v === null) return;
    await fetch('/api/admin/quizzes', { method: 'PATCH', headers, body: JSON.stringify({ id: q.id, time_limit_minutes: v }) });
    load();
  }

  async function moveQuiz(q) {
    const v = prompt('Type the code word of the collection to move this set into. Leave empty to take it out of its collection.', q.collections?.code || '');
    if (v === null) return;
    const code = v.trim().toLowerCase();
    let id = null;
    if (code) {
      const c = collections.find((x) => x.code === code);
      if (!c) return alert('No collection has that code word.');
      id = c.id;
    }
    const res = await fetch('/api/admin/quizzes', { method: 'PATCH', headers, body: JSON.stringify({ id: q.id, collection_id: id }) });
    const data = await res.json();
    if (!res.ok) return alert(data.error || 'Could not move it');
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
    loadCollections();
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
  const chosenCollection = collections.find((c) => c.id === collectionId);
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const canCreateCollection = colForm.code.replace(/-/g, '').length >= 3 && colForm.title.trim();

  // The "add a new creator" form is used both in the quiz form and in the collection form.
  const creatorFold = (
    <details className="fold">
      <summary>+ Add a new creator</summary>
      <div className="stack tight fold-body">
        <label>Name
          <input value={newCreator.name} onChange={(e) => setNewCreator({ ...newCreator, name: e.target.value })} />
        </label>
        <label>Code word <span className="opt-tag">optional</span>
          <input
            value={newCreator.code}
            maxLength={30}
            autoCapitalize="none"
            autoCorrect="off"
            onChange={(e) => setNewCreator({ ...newCreator, code: typeCode(e.target.value) })}
            placeholder="evo"
          />
          <span className="hint">One link and one code for all this creator's courses. Students type it in the code box. You can add it later in the Creators tab.</span>
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
  );

  function renderQuiz(q) {
    const priv = q.listed === false;
    const link = `${origin}/quiz/${q.slug}`;
    const inCollection = Boolean(q.collections);
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
          {q.allow_calculator && <span className="chip">Calculator</span>}
          {priv && q.creators?.name && <span className="chip">{q.creators.name}</span>}
          {inCollection && <span className="chip">In {q.collections.title}</span>}
        </div>
        {priv && !inCollection && (
          <button type="button" className="code-pill" onClick={() => copy(q.slug, 'Code copied')} title="Tap to copy the code">
            <span>Code</span><strong>{q.slug}</strong>
          </button>
        )}
        {inCollection && (
          <button type="button" className="code-pill" onClick={() => copy(q.collections.code, 'Code copied')} title="Tap to copy the collection code">
            <span>Collection code</span><strong>{q.collections.code}</strong>
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
              <button className="btn sm ghost" onClick={() => toggleCalc(q)}>{q.allow_calculator ? 'Turn calculator off' : 'Turn calculator on'}</button>
              {priv && <button className="btn sm ghost" onClick={() => moveQuiz(q)}>Move to collection</button>}
              {q.course && !priv && <button className="btn sm ghost" onClick={() => copyTop(q)}>Copy top 10 post</button>}
              <button className="btn sm danger" onClick={() => remove(q)}>Delete</button>
            </div>
          </details>
        </div>
      </div>
    );
  }

  function renderCreator(c) {
    const link = `${origin}/u/${c.code}`;
    const typed = creatorCodes[c.id] ?? c.code ?? '';
    const courseCount = collections.filter((x) => x.creator_id === c.id).length;
    return (
      <div key={c.id} className="card qitem">
        <div className="qitem-top">
          <strong className="qitem-title">{c.name}</strong>
          <span className="badge private">CREATOR</span>
        </div>
        <div className="chips">
          {c.post && <span className="chip">{c.post}</span>}
          <span className="chip">{courseCount} {courseCount === 1 ? 'course' : 'courses'}</span>
        </div>
        {c.code ? (
          <button type="button" className="code-pill" onClick={() => copy(c.code, 'Code copied')} title="Tap to copy the code word">
            <span>Code</span><strong>{c.code}</strong>
          </button>
        ) : (
          <p className="hint">No code word yet. Add one below so this creator gets one link for all their courses.</p>
        )}
        <label>Code word
          <input
            value={typed}
            maxLength={30}
            autoCapitalize="none"
            autoCorrect="off"
            onChange={(e) => setCreatorCodes({ ...creatorCodes, [c.id]: typeCode(e.target.value) })}
            placeholder="evo"
          />
          <span className="hint">Changing it breaks links you already shared. Leave it empty to remove it.</span>
        </label>
        <div className="row actions">
          <button type="button" className="btn sm" disabled={typed === (c.code || '')} onClick={() => saveCreatorCode(c)}>Save code word</button>
          {c.code && <a className="btn sm ghost" href={`/u/${c.code}`} target="_blank" rel="noreferrer">Open</a>}
          {c.code && <button type="button" className="btn sm ghost" onClick={() => copy(link, 'Link copied')}>Copy link</button>}
        </div>
      </div>
    );
  }

  function renderCollection(c) {
    const link = `${origin}/c/${c.code}`;
    const attempts = c.quizzes.reduce((n, q) => n + q.submissionCount, 0);
    const editing = editId === c.id;
    return (
      <div key={c.id} className={`card qitem ${c.published ? '' : 'off'}`}>
        <div className="qitem-top">
          <strong className="qitem-title">{c.title}</strong>
          <span className="badge private">COLLECTION</span>
        </div>
        <div className="chips">
          <span className="chip">{c.quizzes.length} {c.quizzes.length === 1 ? 'set' : 'sets'}</span>
          <span className="chip">{attempts} attempts</span>
          {c.creators?.name && <span className="chip">{c.creators.name}</span>}
          {!c.published && <span className="chip off">Hidden</span>}
        </div>
        <button type="button" className="code-pill" onClick={() => copy(c.code, 'Code copied')} title="Tap to copy the code word">
          <span>Code</span><strong>{c.code}</strong>
        </button>
        {c.quizzes.length > 0 ? (
          <div className="stack tight">
            {c.quizzes.map((q, n) => (
              <p key={q.id} className="hint">
                {n + 1}. {q.title}, {q.questionCount} questions, {q.submissionCount} attempts{q.published ? '' : ', hidden'}
              </p>
            ))}
          </div>
        ) : (
          <p className="hint">No sets yet. Go to Add a quiz, choose Private set, and pick this collection.</p>
        )}
        <div className="row actions">
          <a className="btn sm" href={`/c/${c.code}`} target="_blank" rel="noreferrer">Open</a>
          <button className="btn sm ghost" onClick={() => copy(link, 'Link copied')}>Copy link</button>
          <button className="btn sm ghost" onClick={() => toggleCollection(c)}>{c.published ? 'Hide' : 'Show'}</button>
          <details className="more">
            <summary className="btn sm ghost">More</summary>
            <div className="more-menu">
              <button className="btn sm ghost" onClick={() => startEdit(c)}>Edit</button>
              <button className="btn sm danger" onClick={() => removeCollection(c)}>Delete</button>
            </div>
          </details>
        </div>

        {editing && (
          <div className="subcard stack tight">
            <label>Code word
              <input value={editForm.code} maxLength={30} onChange={(e) => setEditForm({ ...editForm, code: typeCode(e.target.value) })} />
              <span className="hint">Changing this breaks links you already shared.</span>
            </label>
            <label>Title
              <input value={editForm.title} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })} />
            </label>
            <label>Description <span className="opt-tag">optional</span>
              <input value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} />
            </label>
            <label>Creator card <span className="opt-tag">optional</span>
              <select value={editForm.creatorId} onChange={(e) => setEditForm({ ...editForm, creatorId: e.target.value })}>
                <option value="">No creator card</option>
                {creators.map((x) => <option key={x.id} value={x.id}>{x.name}{x.post ? `, ${x.post}` : ''}</option>)}
              </select>
            </label>
            {colMsg && <p className="error small">{colMsg}</p>}
            <div className="row">
              <button type="button" className="btn sm" onClick={saveEdit}>Save changes</button>
              <button type="button" className="btn sm ghost" onClick={() => setEditId(null)}>Cancel</button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="stack">
      <h1>Admin</h1>

      <div className="seg">
        <button type="button" className={`seg-btn ${view === 'add' ? 'on' : ''}`} onClick={() => setView('add')}>Add a quiz</button>
        <button type="button" className={`seg-btn ${view === 'collections' ? 'on' : ''}`} onClick={() => setView('collections')}>
          Collections <span className="seg-count">{collections.length}</span>
        </button>
        <button type="button" className={`seg-btn ${view === 'creators' ? 'on' : ''}`} onClick={() => setView('creators')}>
          Creators <span className="seg-count">{creators.length}</span>
        </button>
        <button type="button" className={`seg-btn ${view === 'manage' ? 'on' : ''}`} onClick={() => setView('manage')}>
          Manage <span className="seg-count">{counts.all}</span>
        </button>
      </div>

      {view === 'add' && (
        <>
          {done && (
            <div className="card done stack tight">
              <strong className="done-title">
                {done.collection ? `Set added to ${done.collection.title}` : done.listed ? 'Public quiz published' : 'Private set published'}
              </strong>
              {done.collection ? (
                <>
                  <button type="button" className="code-pill big" onClick={() => copy(done.collection.code, 'Code copied')}>
                    <span>Collection code</span><strong>{done.collection.code}</strong>
                  </button>
                  <p className="hint">The collection is still selected below, so you can add the next set straight away.</p>
                </>
              ) : (
                !done.listed && (
                  <button type="button" className="code-pill big" onClick={() => copy(done.slug, 'Code copied')}>
                    <span>Code</span><strong>{done.slug}</strong>
                  </button>
                )
              )}
              <div className="row">
                <button className="btn sm" onClick={() => copy(done.collection ? `${origin}/c/${done.collection.code}` : `${origin}/quiz/${done.slug}`, 'Link copied')}>Copy link</button>
                <a className="btn sm ghost" href={done.collection ? `/c/${done.collection.code}` : `/quiz/${done.slug}`} target="_blank" rel="noreferrer">Open</a>
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
                <span>Hidden. Opens with a code word or link only.</span>
              </button>
            </div>
            <p className={`kind-banner ${kind}`}>
              {isPrivate
                ? chosenCollection
                  ? `PRIVATE: part of the "${chosenCollection.title}" collection. Students find it with the code word "${chosenCollection.code}".`
                  : 'PRIVATE: it will not appear anywhere on the site. Share the code or link yourself.'
                : 'PUBLIC: everyone will see it on the home page.'}
            </p>
          </section>

          <section className="card stack">
            <h2 className="sec-title"><span className="step">2</span>Details</h2>
            <label>Title
              <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder={isPrivate ? 'Evolution Set 1' : 'GES 101 Set A'} />
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

            <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <input type="checkbox" checked={allowCalc} onChange={(e) => setAllowCalc(e.target.checked)} style={{ width: 'auto', marginTop: 4 }} />
              <span>
                Allow calculator
                <span className="hint" style={{ display: 'block' }}>Students get a scientific calculator during this quiz. Leave off for GES quizzes.</span>
              </span>
            </label>

            {isPrivate && (
              <div className="subcard stack tight">
                <label>Collection <span className="opt-tag">optional</span>
                  <select value={collectionId} onChange={(e) => setCollectionId(e.target.value)}>
                    <option value="">No collection (this set gets its own code)</option>
                    {collections.map((c) => <option key={c.id} value={c.id}>{c.title} ({c.code})</option>)}
                  </select>
                  <span className="hint">
                    A collection is one subject with one code word. Students see all its sets and one combined leaderboard. Make collections in the Collections tab.
                  </span>
                </label>

                {chosenCollection ? (
                  <p className="hint">
                    The creator card comes from the collection{chosenCollection.creators?.name ? `: ${chosenCollection.creators.name}` : ''}.
                  </p>
                ) : (
                  <>
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
                    {creatorFold}
                  </>
                )}
              </div>
            )}
          </section>

          <section className="card stack">
            <h2 className="sec-title"><span className="step">3</span>Questions</h2>
            <details className="fold">
              <summary>AI prompt (copy this with your slides)</summary>
              <div className="stack tight fold-body">
                <pre className="prompt">{AI_PROMPT + MATH_NOTE}</pre>
                <button type="button" className="btn sm ghost" onClick={() => copy(AI_PROMPT + MATH_NOTE, 'Prompt copied')}>Copy prompt</button>
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
                    <p className="qtext"><Rich text={q.text} /></p>
                  </div>
                  {images[n + 1] && <img className="qimg" src={images[n + 1]} alt="" />}
                  <div className="qopts">
                    {q.options.map((o, k) => (
                      <p key={k} className={`qopt ${k === q.answer ? 'correct' : ''}`}><b>{LETTERS[k]}</b> <Rich text={o} /></p>
                    ))}
                  </div>
                  {q.explanation && <p className="hint">Why: <Rich text={q.explanation} /></p>}
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
              {busy ? 'Publishing...' : isPrivate ? (chosenCollection ? `Add to ${chosenCollection.title}` : 'Publish private set') : 'Publish public quiz'}
            </button>
            {!canPublish && !busy && <span className="hint-dark">Needs a title and at least one parsed question.</span>}
          </div>
        </>
      )}

      {view === 'collections' && (
        <>
          {colDone && (
            <div className="card done stack tight">
              <strong className="done-title">Collection created</strong>
              <button type="button" className="code-pill big" onClick={() => copy(colDone.code, 'Code copied')}>
                <span>Code</span><strong>{colDone.code}</strong>
              </button>
              <p className="hint">Students type this code word, or open the link. Next, add its sets.</p>
              <div className="row">
                <button className="btn sm" onClick={() => copy(`${origin}/c/${colDone.code}`, 'Link copied')}>Copy link</button>
                <button className="btn sm ghost" onClick={() => { setView('add'); setKind('private'); setColDone(null); window.scrollTo({ top: 0 }); }}>Add a set to it</button>
                <button className="btn sm ghost" onClick={() => setColDone(null)}>Dismiss</button>
              </div>
            </div>
          )}

          <section className="card stack">
            <h2 className="sec-title">New collection</h2>
            <p className="hint">One collection is one subject, for example Physics or Evolution. It gets one code word, a page listing its sets, and one leaderboard.</p>
            <label>Code word
              <input
                value={colForm.code}
                maxLength={30}
                autoCapitalize="none"
                autoCorrect="off"
                onChange={(e) => setColForm({ ...colForm, code: typeCode(e.target.value) })}
                placeholder="evolution"
              />
              <span className="hint">
                What students type, or the end of the link. Letters, numbers and hyphens, 3 to 30 characters. Every collection needs its own.
                {colForm.code && ` Link: ${origin}/c/${colForm.code}`}
              </span>
            </label>
            <label>Title
              <input value={colForm.title} onChange={(e) => setColForm({ ...colForm, title: e.target.value })} placeholder="Evolution" />
              <span className="hint">The name students see at the top of the page.</span>
            </label>
            <label>Description <span className="opt-tag">optional</span>
              <input value={colForm.description} onChange={(e) => setColForm({ ...colForm, description: e.target.value })} placeholder="Chapters 1 to 6 for the first test" />
            </label>
            <label>Creator card <span className="opt-tag">optional</span>
              <select value={colForm.creatorId} onChange={(e) => setColForm({ ...colForm, creatorId: e.target.value })}>
                <option value="">No creator card</option>
                {creators.map((c) => <option key={c.id} value={c.id}>{c.name}{c.post ? `, ${c.post}` : ''}</option>)}
              </select>
              <span className="hint">Shown to students as "Presented by" on the collection page and on each set.</span>
            </label>
            {creatorFold}
            {colMsg && !editId && <p className="error small">{colMsg}</p>}
            <button type="button" className="btn" disabled={!canCreateCollection} onClick={createCollection}>Create collection</button>
          </section>

          {!collections.length && <p className="muted">No collections yet.</p>}
          {collections.map((c) => renderCollection(c))}
        </>
      )}

      {view === 'creators' && (
        <>
          <section className="card stack">
            <h2 className="sec-title">Creator pages</h2>
            <p className="hint">
              Give a creator a code word and they get one page listing all their courses. Students open it with one link, or by typing the code word in the code box.
              A course shows up on the page when you pick that creator on the collection.
            </p>
          </section>
          {!creators.length && <p className="muted">No creators yet. Add the first one below.</p>}
          {creators.map((c) => renderCreator(c))}
          <section className="card stack">
            <h2 className="sec-title">New creator</h2>
            {creatorFold}
          </section>
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