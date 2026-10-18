// A slim progress bar. Used on the study pages.
export default function Bar({ value, label }) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={label}
      style={{ height: 4, borderRadius: 99, background: 'var(--wash-strong)', overflow: 'hidden' }}>
      <div style={{ width: `${pct}%`, height: '100%', background: 'var(--ok)', borderRadius: 99, transition: 'width 0.3s' }} />
    </div>
  );
}