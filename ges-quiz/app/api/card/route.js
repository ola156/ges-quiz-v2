import { ImageResponse } from 'next/og';

export const runtime = 'edge';

const cut = (v, n) => String(v || '').slice(0, n);

// Branded square score card for sharing on WhatsApp, Status and Instagram.
export async function GET(req) {
  const p = new URL(req.url).searchParams;
  const user = cut(p.get('u'), 24);
  const score = Number(p.get('s')) || 0;
  const total = Number(p.get('t')) || 0;
  const quiz = cut(p.get('q'), 60);
  const dept = cut(p.get('d'), 40);
  const rank = cut(p.get('r'), 5);
  const of = cut(p.get('n'), 6);
  const pct = total > 0 ? Math.round((score / total) * 100) : 0;

  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', background: '#1e3a8a', color: '#ffffff', padding: 80, fontFamily: 'sans-serif' }}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: 40, fontWeight: 800, color: '#fbbf24' }}>Instrict Quizmate</div>
          <div style={{ fontSize: 46, fontWeight: 700, marginTop: 24, lineHeight: 1.2 }}>{quiz}</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ fontSize: 260, fontWeight: 800, lineHeight: 1 }}>{`${score}/${total}`}</div>
          <div style={{ fontSize: 60, marginTop: 12, color: '#bfdbfe' }}>{`${pct}%`}</div>
          {rank ? (
            <div style={{ display: 'flex', fontSize: 56, fontWeight: 800, marginTop: 36, background: '#16a34a', padding: '12px 36px', borderRadius: 24 }}>
              {`#${rank}${of ? ` of ${of}` : ''} on the leaderboard`}
            </div>
          ) : null}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: 48, fontWeight: 700 }}>{`@${user}`}</div>
          <div style={{ fontSize: 44, marginTop: 12, color: '#fbbf24', fontWeight: 700 }}>
            {dept ? `Can you beat my score?` : 'Can you beat my score?'}
          </div>
        </div>
      </div>
    ),
    { width: 1080, height: 1080 },
  );
}
