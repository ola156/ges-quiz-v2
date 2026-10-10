import Link from 'next/link';
import { notFound } from 'next/navigation';
import { BRAND } from '../../../lib/brand';
import { getCollectionByCode, getCollectionBoardCached } from '../../../lib/data';
import Board from '../../../components/Board';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }) {
  const { code } = await params;
  const col = await getCollectionByCode(code);
  // Collections are shared by link, so they must not show up in search engines.
  return { title: col ? `${col.title} | ${BRAND}` : 'Collection', robots: { index: false, follow: false } };
}

export default async function CollectionPage({ params }) {
  const { code } = await params;
  const col = await getCollectionByCode(code);
  if (!col) notFound();

  const rows = await getCollectionBoardCached(col.id);
  const creator = col.creators || null;

  return (
    <div className="stack">
      <Link href="/?tab=private" className="back">Back</Link>
      <h1>{col.title}</h1>
      {col.description && <p>{col.description}</p>}

      {creator && (
        <div className="card presented">
          <span className="presented-label">Presented by</span>
          <div className="presented-head">
            {creator.photo_url && <img className="presented-photo" src={creator.photo_url} alt={creator.name} />}
            <div className="presented-who">
              <strong>{creator.name}</strong>
              {creator.post && <span className="muted small">{creator.post}</span>}
            </div>
            {creator.logo_url && <img className="presented-logo" src={creator.logo_url} alt="" />}
          </div>
          {creator.agenda && <p className="small presented-agenda">{creator.agenda}</p>}
        </div>
      )}

      <h2>Choose a set</h2>
      {!col.sets.length && <p className="muted">No sets yet. Check back soon.</p>}
      {col.sets.map((s) => (
        <Link key={s.slug} href={`/quiz/${s.slug}`} className="card link">
          <strong>{s.title}</strong>
          {s.description && <span className="muted">{s.description}</span>}
          <span className="chips">
            <span className="chip">{s.questions?.[0]?.count ?? 0} questions</span>
            {s.time_limit_minutes ? <span className="chip">{s.time_limit_minutes} min</span> : null}
            <span className="chip">{s.submissions?.[0]?.count ?? 0} attempts</span>
          </span>
        </Link>
      ))}

      <h2>{col.title} leaderboard</h2>
      <p className="muted small">Points are your newest score in each set, added together. Finish every set to climb.</p>
      <Board rows={rows} overall />
    </div>
  );
}