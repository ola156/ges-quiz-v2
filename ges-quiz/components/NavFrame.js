'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

// One frame for the student, tutor and admin pages.
// Wide screens: a side menu. Phones: a top bar, a bottom bar with 3 items and "Menu",
// and Menu slides a side panel in with every item.
const CSS = `
.nf { display: grid; grid-template-columns: 240px 1fr; min-height: 100vh; }
.nf-side { position: sticky; top: 0; height: 100vh; overflow-y: auto; display: flex; flex-direction: column; gap: 6px; padding: 20px 14px; background: var(--wash); border-right: 1px solid var(--surface-line); }
.nf-brand { display: block; font-family: var(--font-heading), sans-serif; font-weight: 700; font-size: 1.15rem; color: var(--head); padding: 4px 10px 18px; text-decoration: none; }
.nf-brand span { color: var(--link); }
.nf-brand small { display: block; font-family: inherit; font-size: 0.75rem; font-weight: 500; color: var(--on-dark-muted); letter-spacing: 0.06em; text-transform: uppercase; margin-top: 2px; }
.nf-menu { display: grid; gap: 4px; }
.nf-link { display: flex; align-items: center; gap: 12px; width: 100%; padding: 11px 12px; border: 0; border-radius: 12px; background: transparent; color: var(--on-dark); font: inherit; font-weight: 600; text-align: left; text-decoration: none; cursor: pointer; }
.nf-link:hover { background: var(--wash-strong); }
.nf-link.on { background: var(--blue); color: #fff; }
.nf-link em { margin-left: auto; font-style: normal; font-size: 0.75rem; padding: 1px 8px; border-radius: 99px; background: var(--wash-strong); }
.nf-link.on em { background: rgba(255, 255, 255, 0.25); }
.nf-link em.alert { background: var(--red); color: #fff; }
.nf-foot { margin-top: auto; display: grid; gap: 4px; }
.nf-tools { display: flex; align-items: center; justify-content: space-between; padding: 8px 10px; }
.nf-top, .nf-bar, .nf-scrim { display: none; }
.nf-main { min-width: 0; padding: 28px 28px 64px; }
.nf-body { max-width: 760px; margin: 0 auto; }
.slist { list-style: none; margin: 0; padding: 0; border-top: 1px solid var(--surface-line); }
.slist li { border-bottom: 1px solid var(--surface-line); }
.srow { display: flex; align-items: center; gap: 14px; width: 100%; padding: 16px 4px; background: none; border: 0; color: var(--ink); font: inherit; text-align: left; text-decoration: none; cursor: pointer; }
.srow:hover { background: var(--wash); }
.srow .n { min-width: 1.6em; color: var(--on-dark-muted); font-variant-numeric: tabular-nums; }
.srow .t { flex: 1; min-width: 0; font-weight: 600; color: var(--head); }
.srow .t small { display: block; margin-top: 2px; font-weight: 400; font-size: 0.85rem; color: var(--on-dark-muted); }
.srow .m { color: var(--on-dark-muted); font-size: 0.85rem; white-space: nowrap; }
.srow.go::after { content: '\\203A'; font-size: 1.5rem; line-height: 1; color: var(--on-dark-muted); }
.srow .tick { color: var(--ok); font-weight: 700; }
.srow .dot { width: 18px; height: 18px; border-radius: 50%; border: 2px solid var(--on-dark-muted); flex: none; }
.srow.sel .dot { border-color: var(--link); background: radial-gradient(var(--link) 45%, transparent 50%); }
.slink { background: none; border: 0; padding: 8px 0; color: var(--link); font: inherit; font-weight: 600; cursor: pointer; text-decoration: none; }
.slink:disabled { opacity: 0.4; cursor: default; }
.sbar-note { color: var(--on-dark-muted); font-size: 0.9rem; }
.sgroup { margin: 8px 0 0; font-size: 0.8rem; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; color: var(--on-dark-muted); }
@media (max-width: 860px) {
  .nf { display: block; }
  .nf-side { position: fixed; z-index: 60; top: 0; bottom: 0; left: 0; width: min(300px, 84vw); height: auto; transform: translateX(-102%); transition: transform 0.22s ease; box-shadow: 0 0 40px rgba(0, 0, 0, 0.35); background: var(--bg); }
  .nf.open .nf-side { transform: none; }
  .nf-scrim { display: block; position: fixed; inset: 0; z-index: 55; background: rgba(0, 0, 0, 0.45); opacity: 0; pointer-events: none; transition: opacity 0.22s; }
  .nf.open .nf-scrim { opacity: 1; pointer-events: auto; }
  .nf-top { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 12px 16px; }
  .nf-top .nf-brand { padding: 0; }
  .nf-main { padding: 6px 16px 96px; }
  .nf-bar { display: grid; grid-template-columns: repeat(4, 1fr); position: fixed; left: 0; right: 0; bottom: 0; z-index: 30; padding: 6px 4px calc(6px + env(safe-area-inset-bottom)); background: var(--bg); border-top: 1px solid var(--surface-line); }
  .nf-bar a, .nf-bar button { position: relative; display: grid; justify-items: center; gap: 2px; padding: 6px 2px; border: 0; border-radius: 10px; background: transparent; color: var(--on-dark-muted); font: inherit; font-size: 0.7rem; font-weight: 600; text-decoration: none; cursor: pointer; }
  .nf-bar .on { color: var(--link); background: var(--wash); }
  .nf-bar i { position: absolute; top: 4px; right: 24%; width: 8px; height: 8px; border-radius: 50%; background: var(--red); }
}
`;

const Icon = ({ d }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>
);
const MENU = 'M4 6h16 M4 12h16 M4 18h16';

// items: [{ id, label, icon, href?, match?, except?, exact?, count?, alert? }]
// Items with an href are links. Items without one call onSelect(id), and `current` says which is open.
export default function NavFrame({ items, current, onSelect, brand, sub, tools, footer, children }) {
  const path = usePathname() || '/';
  const [open, setOpen] = useState(false);
  const [tapped, setTapped] = useState(null); // lights up at once while the next page loads

  useEffect(() => { setTapped(null); setOpen(false); }, [path]);
  useEffect(() => {
    if (!open) return undefined;
    const esc = (e) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [open]);

  const isOn = (it) => {
    if (current !== undefined) return current === it.id;
    if (tapped) return tapped === it.id;
    if ((it.except || []).some((p) => path === p || path.startsWith(`${p}/`))) return false;
    const m = it.match || [it.href];
    return it.exact ? m.includes(path) : m.some((p) => path === p || path.startsWith(`${p}/`));
  };

  const item = (it, cls) => {
    const on = isOn(it);
    const inner = (
      <>
        <Icon d={it.icon} />
        <span>{it.label}</span>
        {it.count !== undefined && cls === 'nf-link' && <em className={it.alert ? 'alert' : ''}>{it.count}</em>}
        {it.alert && cls !== 'nf-link' && <i aria-hidden="true" />}
      </>
    );
    const common = { className: `${cls === 'nf-link' ? 'nf-link' : ''} ${on ? 'on' : ''}`.trim(), 'aria-current': on ? 'page' : undefined };
    if (it.href) {
      return (
        <Link key={it.id} href={it.href} {...common} onClick={() => { setTapped(it.id); setOpen(false); }}>{inner}</Link>
      );
    }
    return (
      <button key={it.id} type="button" {...common} onClick={() => { onSelect && onSelect(it.id); setOpen(false); }}>{inner}</button>
    );
  };

  return (
    <div className={`nf ${open ? 'open' : ''}`}>
      <style>{CSS}</style>

      <aside className="nf-side" aria-label="Menu">
        <div className="nf-brand-wrap">{brand}</div>
        <nav className="nf-menu">{items.map((it) => item(it, 'nf-link'))}</nav>
        <div className="nf-foot">
          {footer}
          {tools ? <div className="nf-tools">{tools}</div> : null}
        </div>
      </aside>
      <div className="nf-scrim" onClick={() => setOpen(false)} aria-hidden="true" />

      <header className="nf-top">
        {brand}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>{tools}</div>
      </header>

      <main className="nf-main">
        <div className="nf-body">{children}</div>
      </main>

      <nav className="nf-bar" aria-label="Main menu">
        {items.slice(0, 3).map((it) => item(it, 'nf-tab'))}
        <button type="button" onClick={() => setOpen(true)} aria-expanded={open}>
          <Icon d={MENU} />
          <span>Menu</span>
          {items.slice(3).some((it) => it.alert) && <i aria-hidden="true" />}
        </button>
      </nav>
    </div>
  );
}