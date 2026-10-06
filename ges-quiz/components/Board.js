const fmt = (s) => (!s || s >= 999999 ? '' : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`);

// overall = true for course boards (shows sets done), false for single set boards (shows time)
export default function Board({ rows, me, overall = false }) {
  if (!rows?.length) return <p className="muted small">No scores yet. Be the first.</p>;
  return (
    <ol className="board">
      {rows.map((r, i) => (
        <li key={r.key} className={r.username === me ? 'me' : ''}>
          <span className="pos">{i + 1}</span>
          <span className="who">
            <strong>{r.username}</strong>
            <span className="muted small">
              {[r.department].filter(Boolean).join(', ')}
            </span>
          </span>
          <span className="pts">
            <strong>{r.points}/{r.possible}</strong>
            <span className="muted small">
              {overall ? `${r.sets} ${r.sets === 1 ? 'set' : 'sets'}` : fmt(r.time)}
            </span>
          </span>
        </li>
      ))}
    </ol>
  );
}
