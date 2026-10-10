'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

// Accepts a code word, a single-set code, or a whole pasted link, and opens the right page.
export default function CodeBox() {
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