'use client';
import { useEffect, useRef, useState } from 'react';
import Rich from './Rich';

const RANGES = [[1, 'Today'], [7, '7 days'], [30, '30 days']];

function ago(iso) {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (!Number.isFinite(m) || m < 0) return '';
  if (m < 2) return 'just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} hour${h === 1 ? '' : 's'} ago`;
  const d = Math.round(h / 24);
  return `${d} day${d === 1 ? '' : 's'} ago`;
}

export default function AdminReaders({ pw }) {
  const [days, setDays] = useState(7);
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const seq = useRef(0);

  async function load(d) {
    const mine = ++seq.current;
    const res = await fetch(`/api/admin/readers?days=${d}`, { headers: { 'x-admin-password': pw } });
    const json = await res.json().catch(() => ({}));
    if (mine !== seq.current) return;
    if (!res.ok) { setErr(json.error || 'Could not load'); return; }
    setErr('');
    setData(json);
  }

  useEffect(() => { load(days); }, [days]); // eslint-disable-line react-hooks/exhaustive-deps

  const c = data?.counts;
  return (
    <>
      <div className="row between">
        <div className="row">
          {RANGES.map(([d, label]) => (
            <button key={d} type="button" className={`btn sm ${days === d ? '' : 'ghost'}`} onClick={() => setDays(d)}>{label}</button>
          ))}
        </div>
        <button type="button" className="btn sm ghost" onClick={() => load(days)}>Refresh</button>
      </div>

      {err && <p className="error">{err}</p>}
      {!data && !err && <p className="muted">Loading...</p>}

      {data && (
        <>
          <section className="card stack tight">
            <div className="chips">
              <span className="chip"><strong>{c.now}</strong> reading now</span>
              <span className="chip"><strong>{c.day}</strong> today</span>
              <span className="chip"><strong>{c.week}</strong> this week</span>
              <span className="chip"><strong>{c.month}</strong> in 30 days</span>
            </div>
            <p className="hint">Counts are people with study activity. Reading now means activity in the last 15 minutes.{data.truncated ? ' Showing the most recent 10,000 records.' : ''}</p>
          </section>

          <section className="card stack tight">
            <h2 className="sec-title">Subject votes</h2>
            <p className="hint">What JAMB students want built next, one vote per student per subject, up to 3 each.</p>
            {!data.votes?.length && <p className="muted small">No votes yet.</p>}
            {(data.votes || []).map((v, i) => (
              <div key={i} className="tutor-row">
                <strong style={{ textTransform: 'capitalize' }}>{v.subject}</strong>
                <span className="chip">{v.votes} vote{v.votes === 1 ? '' : 's'}</span>
              </div>
            ))}
          </section>

          <section className="card stack tight">
            <h2 className="sec-title">Courses being read</h2>
            {!data.subjects.length && <p className="muted small">Nobody has studied in this period.</p>}
            {data.subjects.map((s, i) => (
              <div key={i} className="tutor-row">
                <div>
                  <strong><Rich text={s.name} /></strong>
                  <p className="muted small">{s.lessons} lesson{s.lessons === 1 ? '' : 's'} opened, {s.completed} finished reading</p>
                </div>
                <span className="chip">{s.readers} reader{s.readers === 1 ? '' : 's'}</span>
              </div>
            ))}
          </section>

          <section className="card stack tight">
            <h2 className="sec-title">Most read lessons</h2>
            {!data.lessons.length && <p className="muted small">Nothing yet.</p>}
            {data.lessons.map((l, i) => (
              <div key={i} className="tutor-row">
                <div>
                  <span><Rich text={l.title} /></span>
                  <p className="muted small"><Rich text={l.subject} />, <Rich text={l.topic} /></p>
                </div>
                <span className="chip">{l.readers}</span>
              </div>
            ))}
          </section>

          <section className="card stack tight">
            <h2 className="sec-title">Who is reading what</h2>
            {!data.recent.length && <p className="muted small">Nobody yet.</p>}
            {data.recent.map((r, i) => (
              <div key={i} className="tutor-row">
                <div>
                  <strong>{r.name}</strong>
                  <p className="muted small"><Rich text={r.subject} />: <Rich text={r.title} /></p>
                </div>
                <span className="muted small">{ago(r.at)}</span>
              </div>
            ))}
          </section>
        </>
      )}
    </>
  );
}