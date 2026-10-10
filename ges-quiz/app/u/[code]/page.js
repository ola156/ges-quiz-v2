import Link from 'next/link';
import { notFound } from 'next/navigation';
import { BRAND } from '../../../lib/brand';
import { getCreatorByCode } from '../../../lib/data';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }) {
  const { code } = await params;
  const creator = await getCreatorByCode(code);
  // Shared by link, so it must not show up in search engines.
  return { title: creator ? `${creator.name} | ${BRAND}` : 'Creator', robots: { index: false, follow: false } };
}

export default async function CreatorPage({ params }) {
  const { code } = await params;
  const creator = await getCreatorByCode(code);
  if (!creator) notFound();

  const empty = !creator.courses.length && !creator.loose.length;

  return (
    <div className="stack">
      <Link href="/?tab=private" className="back">Back</Link>
      <h1>{creator.name}</h1>

      <div className="card presented">
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

      <h2>Choose a course</h2>
      {empty && <p className="muted">No courses yet. Check back soon.</p>}
      {creator.courses.map((c) => (
        <Link key={c.code} href={`/c/${c.code}`} className="card link">
          <strong>{c.title}</strong>
          {c.description && <span className="muted">{c.description}</span>}
          <span className="chips">
            <span className="chip">{c.sets} {c.sets === 1 ? 'set' : 'sets'}</span>
            <span className="chip">{c.questions} questions</span>
          </span>
        </Link>
      ))}

      {creator.loose.length > 0 && (
        <>
          <h2>More sets</h2>
          {creator.loose.map((s) => (
            <Link key={s.slug} href={`/quiz/${s.slug}`} className="card link">
              <strong>{s.title}</strong>
              {s.description && <span className="muted">{s.description}</span>}
              <span className="chips">
                <span className="chip">{s.questions?.[0]?.count ?? 0} questions</span>
                {s.time_limit_minutes ? <span className="chip">{s.time_limit_minutes} min</span> : null}
              </span>
            </Link>
          ))}
        </>
      )}
    </div>
  );
}