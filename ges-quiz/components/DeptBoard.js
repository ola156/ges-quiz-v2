import { MIN_DEPT } from '../lib/leaderboard';

export default function DeptBoard({ rows, me }) {
  if (!rows?.length)
    return <p className="muted small">No department has {MIN_DEPT} students on this course yet. Tell your classmates to take part.</p>;
  return (
    <ol className="board">
      {rows.map((r, i) => (
        <li key={r.name} className={me && r.name.toLowerCase() === me.toLowerCase() ? 'me' : ''}>
          <span className="pos">{i + 1}</span>
          <span className="who">
            <strong>{r.name}</strong>
            <span className="muted small">{r.students} students</span>
          </span>
          <span className="pts"><strong>{r.avg}%</strong><span className="muted small">average</span></span>
        </li>
      ))}
    </ol>
  );
}
