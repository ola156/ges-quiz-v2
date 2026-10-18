import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@clerk/nextjs/server';
import { SignOutButton } from '@clerk/nextjs';
import { getMember, TRACKS } from '../../lib/member';
import { schoolName } from '../../lib/schools';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Profile | Instrict Quizmate', robots: { index: false, follow: false } };

export default async function Profile() {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');
  const m = await getMember(userId);
  if (!m) redirect('/onboarding');

  const tutor = m.role === 'tutor';
  const rows = tutor
    ? [
        ['Name', m.display_name],
        ['Email', m.email],
        ['Centre', m.centre],
        ['Teaches', (m.tracks || []).map((t) => TRACKS[t]).filter(Boolean).join(', ')],
        ['Schools', (m.schools || []).map(schoolName).join(', ')],
      ]
    : [
        ['Name', m.display_name],
        ['Email', m.email],
        ['Preparing for', TRACKS[m.track]],
        ['School', schoolName(m.school)],
        ['Department', m.department],
        ['Level', m.class_level ? `${m.class_level} level` : ''],
      ];

  return (
    <div className="stack">
      <h1>Profile</h1>
      <p className="muted small">{tutor ? 'Tutor account' : 'Student account'}</p>
      <dl className="stack tight" style={{ margin: 0 }}>
        {rows.filter(([, v]) => v).map(([k, v]) => (
          <div key={k} className="card" style={{ display: 'grid', gap: 2 }}>
            <dt className="muted small">{k}</dt>
            <dd style={{ margin: 0, fontWeight: 600, wordBreak: 'break-word' }}>{v}</dd>
          </div>
        ))}
      </dl>
      <Link href="/onboarding?edit=1" className="btn">Edit details</Link>
      <SignOutButton redirectUrl="/">
        <button type="button" className="slink" style={{ justifySelf: 'start', background: 'none', border: 0, color: 'var(--link)', font: 'inherit', fontWeight: 600, cursor: 'pointer', padding: '8px 0' }}>Log out</button>
      </SignOutButton>
    </div>
  );
}