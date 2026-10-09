'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

// Accepts the code, or a whole pasted link, and opens the private set.
export default function CodeBox() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function go(e) {
    e.preventDefault();
    const clean = code.trim().split('?')[0].split('/').filter(Boolean).pop() || '';
    const c = clean.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!c) return;
    setBusy(true);
    setError('');
    try {
      const res = await fetch(`/api/private/${c}`);
      const data = await res.json();
      if (!data.ok) {
        setError('We could not find a set with that code. Check it and try again.');
        setBusy(false);
        return;
      }
      router.push(`/quiz/${c}`);
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
        aria-label="Private set code"
      />
      {error && <p className="error small">{error}</p>}
      <button className="btn" disabled={busy || !code.trim()}>{busy ? 'Opening...' : 'Open set'}</button>
    </form>
  );
}
