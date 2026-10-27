'use client';
import { useState } from 'react';

const MAX = 3;

// "Which subject should we build next?" A student can pick up to 3.
export default function VoteList({ subjects, mine }) {
  const [picked, setPicked] = useState(new Set(mine));
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  async function toggle(s) {
    if (busy) return;
    setBusy(s.key);
    setError('');
    try {
      const res = await fetch('/api/vote', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ subject: s.name }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not save your vote.');
      setPicked((p) => {
        const n = new Set(p);
        if (data.voted) n.add(s.key); else n.delete(s.key);
        return n;
      });
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy('');
    }
  }

  return (
    <section className="stack tight">
      <h2 className="card-h">Vote for the next subject</h2>
      <p className="muted small">Pick up to {MAX} subjects you want most. We build the most voted first. You have used {picked.size} of {MAX}.</p>
      <div className="chips">
        {subjects.map((s) => {
          const on = picked.has(s.key);
          return (
            <button key={s.key} type="button" className={`chip ${on ? 'on' : ''}`} disabled={busy === s.key} aria-pressed={on}
              style={{ cursor: 'pointer', ...(on ? { fontWeight: 700, borderColor: 'var(--link)', color: 'var(--link)' } : null) }}
              onClick={() => toggle(s)}>
              {on ? '✓ ' : ''}{s.name}
            </button>
          );
        })}
      </div>
      {error && <p className="error">{error}</p>}
    </section>
  );
}