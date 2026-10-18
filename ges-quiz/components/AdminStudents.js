'use client';
import { useEffect, useRef, useState } from 'react';
import { SCHOOLS } from '../lib/schools';

const TRACKS = [['jamb', 'JAMB'], ['waec', 'WAEC'], ['post_utme', 'Post-UTME'], ['university', 'University']];
const trackName = (t) => TRACKS.find(([k]) => k === t)?.[1] || t;
const schoolShort = (id) => SCHOOLS.find((s) => s.id === id)?.short || id;
const day = (iso) => (iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '');

export default function AdminStudents({ pw, flash }) {
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(30);
  const [q, setQ] = useState('');
  const [track, setTrack] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [err, setErr] = useState('');
  const [edit, setEdit] = useState(null); // { id, track, school }
  const [busy, setBusy] = useState(false);
  const seq = useRef(0);
  const headers = { 'Content-Type': 'application/json', 'x-admin-password': pw };

  async function load(p = page) {
    const mine = ++seq.current;
    const url = `/api/admin/students?page=${p}&track=${track}&q=${encodeURIComponent(q)}`;
    const res = await fetch(url, { headers: { 'x-admin-password': pw } });
    const data = await res.json().catch(() => ({}));
    if (mine !== seq.current) return; // an older request finished late
    if (!res.ok) { setErr(data.error || 'Could not load students'); setLoaded(true); return; }
    setErr('');
    setRows(data.students);
    setTotal(data.total);
    setSize(data.pageSize);
    setLoaded(true);
  }

  // Typing waits a moment before searching, so each keystroke does not hit the server.
  useEffect(() => {
    const t = setTimeout(() => { setPage(0); load(0); }, 300);
    return () => clearTimeout(t);
  }, [q, track]); // eslint-disable-line react-hooks/exhaustive-deps

  function go(p) {
    setPage(p);
    load(p);
    window.scrollTo({ top: 0 });
  }

  async function save() {
    setBusy(true);
    const res = await fetch('/api/admin/students', { method: 'PATCH', headers, body: JSON.stringify(edit) });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setErr(data.error || 'Could not save');
    setErr('');
    setEdit(null);
    flash('Saved');
    load();
  }

  async function reset(s) {
    if (!window.confirm(`Reset ${s.name || s.email || 'this student'}? Their profile is removed and they pick their exam again next time they sign in. Their sign-in account stays.`)) return;
    const res = await fetch('/api/admin/students', { method: 'DELETE', headers, body: JSON.stringify({ id: s.id }) });
    if (!res.ok) return setErr((await res.json().catch(() => ({}))).error || 'Could not reset');
    flash('Profile reset');
    load();
  }

  const pages = Math.max(1, Math.ceil(total / size));

  return (
    <>
      <section className="card stack tight">
        <h2 className="sec-title">Student accounts</h2>
        <p className="hint">{loaded ? `${total} ${total === 1 ? 'student' : 'students'}` : 'Loading...'}. Change a student's exam or school, or reset their profile.</p>
        <div className="searchbox">
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name or email" aria-label="Search students" />
          {q && <button type="button" className="clear" onClick={() => setQ('')} aria-label="Clear search">×</button>}
        </div>
        <div className="filters">
          {[['', 'All'], ...TRACKS].map(([k, l]) => (
            <button key={k || 'all'} type="button" className={`fchip ${track === k ? 'on' : ''}`} onClick={() => setTrack(k)}>{l}</button>
          ))}
        </div>
      </section>

      {err && <p className="error">{err}</p>}
      {loaded && !rows.length && !err && <p className="muted">No students found.</p>}

      {rows.map((s) => (
        <section key={s.id} className="card stack tight">
          <div className="tutor-row">
            <div style={{ minWidth: 0 }}>
              <strong>{s.name || 'No name'}</strong>
              <p className="muted small" style={{ overflowWrap: 'anywhere' }}>{s.email}</p>
              <p className="muted small">
                {[trackName(s.track), s.school && schoolShort(s.school), s.department, s.level && `${s.level} level`].filter(Boolean).join(', ')}
                {s.joined ? `. Joined ${day(s.joined)}` : ''}
              </p>
            </div>
            <div className="row">
              <button type="button" className="btn sm ghost" onClick={() => setEdit(edit?.id === s.id ? null : { id: s.id, track: s.track, school: s.school })}>{edit?.id === s.id ? 'Cancel' : 'Edit'}</button>
              <button type="button" className="btn sm ghost" onClick={() => reset(s)}>Reset</button>
            </div>
          </div>
          {edit?.id === s.id && (
            <div className="stack tight">
              <label>Exam
                <select value={edit.track} onChange={(e) => setEdit({ ...edit, track: e.target.value, school: '' })}>
                  {TRACKS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                </select>
              </label>
              {(edit.track === 'post_utme' || edit.track === 'university') && (
                <label>School
                  <select value={edit.school} onChange={(e) => setEdit({ ...edit, school: e.target.value })}>
                    <option value="">Select</option>
                    {SCHOOLS.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                  </select>
                </label>
              )}
              <div><button type="button" className="btn sm" disabled={busy} onClick={save}>{busy ? 'Saving...' : 'Save'}</button></div>
            </div>
          )}
        </section>
      ))}

      {pages > 1 && (
        <div className="row between">
          <button type="button" className="btn sm ghost" disabled={page === 0} onClick={() => go(page - 1)}>Previous</button>
          <span className="muted small">Page {page + 1} of {pages}</span>
          <button type="button" className="btn sm ghost" disabled={page + 1 >= pages} onClick={() => go(page + 1)}>Next</button>
        </div>
      )}
    </>
  );
}