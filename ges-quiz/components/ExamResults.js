'use client';
import { useEffect, useMemo, useState } from 'react';
import { lagos } from '../lib/exam';
import { jambTotal, waecGrade } from '../lib/grade';

const mmss = (s) => (s || s === 0 ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` : '');

const CSS = `
.rs-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 10px; }
.rs-stats > div { display: grid; gap: 2px; padding: 12px 14px; border: 1px solid var(--surface-line); border-radius: 12px; background: var(--wash); }
.rs-stats span { color: var(--on-dark-muted); font-size: 0.8rem; font-weight: 600; }
.rs-stats strong { font-size: 1.6rem; line-height: 1.15; color: var(--head); }
.rs-stats em { font-style: normal; font-size: 0.78rem; color: var(--on-dark-muted); }
.rs-sub { display: grid; gap: 10px; }
.rs-sub-row { display: grid; grid-template-columns: minmax(80px, 1fr) 3fr auto; align-items: center; gap: 10px; font-size: 0.9rem; }
.rs-track { height: 6px; border-radius: 99px; background: var(--wash-strong); overflow: hidden; }
.rs-track i { display: block; height: 100%; background: var(--ok); border-radius: 99px; }
.rs-list { list-style: none; margin: 0; padding: 0; border-top: 1px solid var(--surface-line); }
.rs-row { display: grid; grid-template-columns: 2.2em 1fr auto; gap: 4px 12px; align-items: start; padding: 14px 2px; border-bottom: 1px solid var(--surface-line); }
.rs-rank { color: var(--on-dark-muted); font-variant-numeric: tabular-nums; padding-top: 2px; }
.rs-name { min-width: 0; font-weight: 600; color: var(--head); overflow-wrap: anywhere; }
.rs-name small { display: block; margin-top: 2px; font-weight: 400; font-size: 0.8rem; color: var(--on-dark-muted); }
.rs-score { text-align: right; font-size: 1.15rem; font-weight: 700; color: var(--head); white-space: nowrap; }
.rs-score small { display: block; font-size: 0.78rem; font-weight: 500; color: var(--on-dark-muted); }
.rs-chips { grid-column: 2 / 4; display: flex; flex-wrap: wrap; gap: 6px; margin-top: 4px; }
.rs-chips span { padding: 2px 10px; border-radius: 99px; background: var(--wash-strong); color: var(--ink); font-size: 0.8rem; }
.rs-meta { grid-column: 2 / 4; font-size: 0.8rem; color: var(--on-dark-muted); }
.rs-tools { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
.rs-tools input { flex: 1; min-width: 160px; }
`;

export default function ExamResults({ examId, title, track }) {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');
  const [sort, setSort] = useState('score');
  const [find, setFind] = useState('');

  // Refreshes by itself every 10 seconds, so the tutor sees students appear as they finish.
  useEffect(() => {
    let live = true;
    const load = async () => {
      try {
        const res = await fetch(`/api/tutor/exams/${examId}/results`, { cache: 'no-store' });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Could not load results.');
        if (live) { setRows(data.results); setError(''); }
      } catch (e) {
        if (live) setError(e.message);
      }
    };
    load();
    const t = setInterval(load, 10000);
    return () => { live = false; clearInterval(t); };
  }, [examId]);

  const subjectNames = useMemo(() => (rows ? [...new Set(rows.flatMap((r) => Object.keys(r.subjects || {})))] : []), [rows]);
  const jamb = track === 'jamb' && subjectNames.length > 0;
  const outOf = 100 * subjectNames.length;

  // One number per student: the JAMB score for JAMB exams, otherwise the percentage.
  const data = useMemo(() => (rows || []).map((r) => {
    const jt = jamb ? jambTotal(r.subjects, subjectNames) : null;
    return { ...r, main: jamb ? jt : r.percent, jt };
  }), [rows, jamb, subjectNames]);

  const list = useMemo(() => {
    const f = find.trim().toLowerCase();
    const shown = f ? data.filter((r) => r.name.toLowerCase().includes(f)) : data;
    return [...shown].sort((a, b) =>
      sort === 'name' ? a.name.localeCompare(b.name)
        : sort === 'recent' ? Date.parse(b.at) - Date.parse(a.at)
          : b.main - a.main || (a.time ?? 1e9) - (b.time ?? 1e9));
  }, [data, sort, find]);

  const stats = useMemo(() => {
    if (!data.length) return null;
    const mains = data.map((r) => r.main);
    const avg = mains.reduce((n, v) => n + v, 0) / mains.length;
    const passLine = jamb ? outOf / 2 : 50;
    const times = data.map((r) => r.time).filter((t) => t || t === 0);
    return {
      avg: Math.round(avg),
      hi: Math.max(...mains),
      lo: Math.min(...mains),
      pass: Math.round((mains.filter((v) => v >= passLine).length / mains.length) * 100),
      time: times.length ? Math.round(times.reduce((n, v) => n + v, 0) / times.length) : null,
    };
  }, [data, jamb, outOf]);

  const subjectAvg = useMemo(() => subjectNames.map((n) => {
    const got = data.filter((r) => r.subjects?.[n]?.[1]);
    const pct = got.length ? Math.round(got.reduce((s, r) => s + (r.subjects[n][0] / r.subjects[n][1]) * 100, 0) / got.length) : 0;
    return { name: n, pct };
  }), [data, subjectNames]);

  const fmt = (v) => (jamb ? `${v}/${outOf}` : `${v}%`);

  return (
    <section className="stack">
      <style>{CSS}</style>
      <div className="row between">
        <h2>Results{rows ? ` (${rows.length})` : ''}</h2>
        <a className="btn sm" href={`/api/tutor/exams/${examId}/results?format=csv`}>Download for Excel</a>
      </div>
      {error && <p className="error small">{error}</p>}
      {!rows && !error && <p className="muted small">Loading...</p>}
      {rows && !rows.length && <p className="muted small">Nobody has handed in yet. This page updates by itself.</p>}

      {stats && (
        <>
          <div className="rs-stats">
            <div><span>Students</span><strong>{data.length}</strong><em>handed in</em></div>
            <div><span>Average</span><strong>{fmt(stats.avg)}</strong><em>{jamb ? 'JAMB score' : 'class score'}</em></div>
            <div><span>Highest</span><strong>{fmt(stats.hi)}</strong><em>lowest {fmt(stats.lo)}</em></div>
            <div><span>Passed</span><strong>{stats.pass}%</strong><em>{jamb ? `${outOf / 2} and above` : '50% and above'}</em></div>
            {stats.time !== null && <div><span>Average time</span><strong>{mmss(stats.time)}</strong><em>minutes</em></div>}
          </div>
          {jamb && subjectNames.length !== 4 && (
            <p className="muted small">JAMB scores add each subject out of 100. This exam has {subjectNames.length} {subjectNames.length === 1 ? 'subject' : 'subjects'}, so the total is out of {outOf}. Four subjects give the usual 400.</p>
          )}

          {subjectAvg.length > 1 && (
            <div className="card stack tight">
              <h3 className="card-h">Average by subject</h3>
              <div className="rs-sub">
                {subjectAvg.map((s) => (
                  <div key={s.name} className="rs-sub-row">
                    <span>{s.name || 'Subject'}</span>
                    <div className="rs-track" role="img" aria-label={`${s.name} ${s.pct}%`}><i style={{ width: `${s.pct}%` }} /></div>
                    <strong>{s.pct}%</strong>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="rs-tools">
            <input type="search" value={find} onChange={(e) => setFind(e.target.value)} placeholder="Find a student" aria-label="Find a student" />
            {[['score', 'Highest'], ['name', 'Name'], ['recent', 'Newest']].map(([k, l]) => (
              <button key={k} type="button" className={`btn sm ${sort === k ? '' : 'ghost'}`} onClick={() => setSort(k)}>{l}</button>
            ))}
          </div>

          <ol className="rs-list">
            {list.map((r, i) => {
              const extra = [r.department, r.level && `${r.level}L`].filter(Boolean).join(', ');
              return (
                <li key={`${r.name}-${r.at}-${i}`} className="rs-row">
                  <span className="rs-rank">{sort === 'score' && !find ? i + 1 : ''}</span>
                  <span className="rs-name">{r.name}{extra ? <small>{extra}</small> : null}</span>
                  <span className="rs-score">
                    {jamb ? `${r.jt}` : `${r.percent}%`}
                    <small>{jamb ? `out of ${outOf}` : `${r.score}/${r.total}`}</small>
                  </span>
                  {subjectNames.length > 1 && (
                    <div className="rs-chips">
                      {subjectNames.map((n) => {
                        const s = r.subjects?.[n];
                        const pct = s && s[1] ? Math.round((s[0] / s[1]) * 100) : null;
                        return (
                          <span key={n}>
                            {n || 'Subject'}: {s ? `${s[0]}/${s[1]}` : 'none'}{pct !== null && track === 'waec' ? ` (${waecGrade(pct)})` : jamb && pct !== null ? ` (${pct})` : ''}
                          </span>
                        );
                      })}
                    </div>
                  )}
                  <span className="rs-meta">
                    {[r.time || r.time === 0 ? `Time ${mmss(r.time)}` : '', `Handed in ${lagos(r.at)}`, jamb ? `${r.score}/${r.total} questions` : '', r.late ? 'Late, not ranked' : ''].filter(Boolean).join('  ·  ')}
                  </span>
                </li>
              );
            })}
          </ol>
          {!list.length && <p className="muted small">No student matches that name.</p>}
        </>
      )}
    </section>
  );
}