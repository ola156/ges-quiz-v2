import { NextResponse } from 'next/server';
import { db } from '../../../lib/supabase';

export async function GET() {
  const { data } = await db().from('profiles').select('department').limit(3000);
  const counts = new Map();
  for (const r of data || []) {
    const d = String(r.department || '').trim().replace(/\s+/g, ' ');
    if (!d) continue;
    const k = d.toLowerCase();
    const cur = counts.get(k);
    counts.set(k, { name: cur?.name || d, n: (cur?.n || 0) + 1 });
  }
  const departments = [...counts.values()].sort((a, b) => b.n - a.n).slice(0, 80).map((x) => x.name);
  return NextResponse.json(
    { departments },
    { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' } },
  );
}