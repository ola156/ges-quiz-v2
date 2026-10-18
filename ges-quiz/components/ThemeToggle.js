'use client';
import { useEffect, useState } from 'react';

// Light, dark, or follow the device. The choice is kept in this browser only.
export default function ThemeToggle() {
  const [theme, setTheme] = useState('system');

  useEffect(() => {
    try { setTheme(localStorage.getItem('theme') || 'system'); } catch {}
  }, []);

  function pick(next) {
    setTheme(next);
    const root = document.documentElement;
    if (next === 'system') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', next);
    try {
      if (next === 'system') localStorage.removeItem('theme');
      else localStorage.setItem('theme', next);
    } catch {}
  }

  const isDark = () =>
    theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  return (
    <button
      type="button"
      className="theme-btn"
      onClick={() => pick(isDark() ? 'light' : 'dark')}
      aria-label="Switch between light and dark mode"
      title="Switch between light and dark mode">
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
      </svg>
    </button>
  );
}
