'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import CodeBox from './CodeBox';

const CSS = `
.pl-search { position: relative; }
.pl-search input { width: 100%; padding-right: 40px; }
.pl-search button { position: absolute; right: 6px; top: 50%; transform: translateY(-50%); width: 32px; height: 32px; border: 0; border-radius: 8px; background: transparent; color: var(--on-dark-muted); font-size: 1.3rem; cursor: pointer; }
.pl-group { margin: 14px 0 0; display: flex; align-items: baseline; justify-content: space-between; gap: 10px; }
.pl-group h2 { margin: 0; font-size: 1rem; }
.pl-group a { font-size: 0.85rem; color: var(--link); text-decoration: none; font-weight: 600; }
.pl-list { list-style: none; margin: 6px 0 0; padding: 0; border-top: 1px solid var(--surface-line); }
.pl-list li { border-bottom: 1px solid var(--surface-line); }
.pl-row { display: flex; align-items: center; gap: 12px; padding: 14px 4px; color: var(--ink); text-decoration: none; }
.pl-row:hover { background: var(--wash); }
.pl-row .t { flex: 1; min-width: 0; font-weight: 600; color: var(--head); overflow-wrap: anywhere; }
.pl-row .t small { display: block; margin-top: 2px; font-weight: 400; font-size: 0.85rem; color: var(--on-dark-muted); }
.pl-row::after { content: '\\203A'; font-size: 1.5rem; line-height: 1; color: var(--on-dark-muted); }
.pl-code summary { cursor: pointer; font-weight: 600; color: var(--link); }
`;

export default function PracticeList({ items, label, signedIn, track }) {
  const [q, setQ] = useState('');

  const groups = useMemo(() => {
    const f = q.trim().toLowerCase();
    const shown = f
      ? items.filter((x) => [x.title, x.course, x.description].some((v) => v.toLowerCase().includes(f)))
      : items;
    const m = new Map();
    for (const x of shown) {
      const k = x.course || 'Other sets';
      if (!m.has(k)) m.set(k, []);
      m.get(k).push(x);
    }
    return [...m.entries()].sort(([a], [b]) => (a === 'Other sets') - (b === 'Other sets') || a.localeCompare(b));
  }, [items, q]);

  const found = groups.reduce((n, [, l]) => n + l.length, 0);

  return (
    <div className="stack">
      <style>{CSS}</style>
      <h1>Practice</h1>
      {label && <p className="muted small">Public quizzes for {label}.</p>}

      <div className="pl-search">
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by course, title or topic" aria-label="Search practice sets" />
        {q && <button type="button" onClick={() => setQ('')} aria-label="Clear search">&times;</button>}
      </div>

      <details className="pl-code">
        <summary>Have a code or link?</summary>
        <div style={{ marginTop: 10 }}><CodeBox /></div>
      </details>

      {!items.length && (
        <p className="muted">
          {track && track !== 'university'
            ? 'There are no public practice sets for your exam yet. Study mode is ready, and you can still open a quiz with a code.'
            : 'No public quizzes yet. Check back soon.'}
        </p>
      )}
      {items.length > 0 && !found && <p className="muted">Nothing matches that search.</p>}

      {groups.map(([name, list]) => (
        <section key={name}>
          <div className="pl-group">
            <h2>{name}</h2>
           
          </div>
          <ul className="pl-list">
            {list.map((x) => (
              <li key={x.slug}>
                <Link href={`/quiz/${x.slug}`} className="pl-row">
                  <span className="t">
                    {x.title}
                    <small>{[`${x.count} questions`, x.minutes ? `${x.minutes} min` : ''].filter(Boolean).join(' · ')}</small>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}