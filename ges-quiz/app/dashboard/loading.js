export default function Loading() {
  return (
    <div className="stack" aria-busy="true">
      <div style={{ height: 28, width: '45%', borderRadius: 8, background: 'var(--wash-strong)' }} />
      <div style={{ height: 90, borderRadius: 12, background: 'var(--wash)' }} />
      <div style={{ height: 90, borderRadius: 12, background: 'var(--wash)' }} />
    </div>
  );
}