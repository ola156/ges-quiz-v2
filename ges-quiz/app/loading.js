// Shows instantly while a page loads, so a tap never feels dead.
export default function Loading() {
  return (
    <div className="stack" aria-busy="true" aria-label="Loading">
      <div className="sk sk-hero" />
      <div className="sk sk-line" />
      <div className="sk sk-card" />
      <div className="sk sk-card" />
      <div className="sk sk-card" />
      <style>{`
        .sk {
          border-radius: 16px;
          background: linear-gradient(90deg, rgba(255,255,255,.06), rgba(255,255,255,.14), rgba(255,255,255,.06));
          background-size: 200% 100%;
          animation: sk 1.2s ease-in-out infinite;
        }
        .sk-hero { height: 140px; border-radius: 22px; }
        .sk-line { height: 22px; width: 45%; }
        .sk-card { height: 84px; }
        @keyframes sk { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
      `}</style>
    </div>
  );
}