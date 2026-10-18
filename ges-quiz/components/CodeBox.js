'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

// Accepts a code word, a single-set code, or a whole pasted link, and opens the right page.
// variant="line" is the quiet one-line version used on the student home. The default keeps the old look.
export default function CodeBox({ variant }) {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function go(e) {
    e.preventDefault();
    const last = code.trim().split('?')[0].split('/').filter(Boolean).pop() || '';
    const c = last.toLowerCase().replace(/[^a-z0-9-]/g, '').replace(/^-+|-+$/g, '');
    if (!c) return;
    setBusy(true);
    setError('');
    try {
      const res = await fetch(`/api/resolve/${encodeURIComponent(c)}`);
      const data = await res.json();
      if (!data.ok) {
        setError('We could not find anything with that code. Check it and try again.');
        setBusy(false);
        return;
      }
      router.push(data.path);
    } catch {
      setError('Check your connection and try again.');
      setBusy(false);
    }
  }

  if (variant === 'line') {
    return (
      <form className="dh-code" onSubmit={go}>
        <div className="dh-code-row">
          <input
            id="home-code"
            className="dh-input"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Enter a code or paste a link"
            autoCapitalize="none"
            autoCorrect="off"
            autoComplete="off"
            spellCheck={false}
            aria-label="Quiz code or link"
          />
          <button type="submit" className="dh-go" disabled={busy || !code.trim()} aria-label={busy ? 'Opening' : 'Open'}>
            {busy ? (
              <span className="dh-dots" aria-hidden="true">...</span>
            ) : (
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14 M13 6l6 6-6 6" /></svg>
            )}
          </button>
        </div>
        {error && <p className="error small" role="alert">{error}</p>}
      </form>
    );
  }

  return (
    <form className="stack tight" onSubmit={go}>
      <input
        className="code-input"
        value={code}
        onChange={(e) => setCode(e.target.value)}
        placeholder="Enter code"
        autoCapitalize="none"
        autoCorrect="off"
        autoComplete="off"
        aria-label="Code"
      />
      {error && <p className="error small">{error}</p>}
      <button className="btn" disabled={busy || !code.trim()}>{busy ? 'Opening...' : 'Open'}</button>
    </form>
  );
}