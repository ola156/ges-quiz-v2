import { NextResponse } from 'next/server';
import { db } from '../../../../lib/supabase';
import { isAdmin } from '../../../../lib/admin';
import { getCourseBoard, getDeptBoard } from '../../../../lib/leaderboard';

// Ready-to-paste WhatsApp post: the top 10 of a course plus the top departments.
export async function GET(req) {
  if (!isAdmin(req)) return NextResponse.json({ error: 'Wrong password' }, { status: 401 });
  const url = new URL(req.url);
  const course = (url.searchParams.get('course') || '').trim();
  if (!course) return NextResponse.json({ error: 'Course is required' }, { status: 400 });

  const supabase = db();
  const [rows, depts] = await Promise.all([
    getCourseBoard(supabase, course, 10),
    getDeptBoard(supabase, course, 3),
  ]);
  if (!rows.length) return NextResponse.json({ error: 'No scores for this course yet' }, { status: 404 });

  const date = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  const medal = ['🥇', '🥈', '🥉'];
  const lines = rows.map((r, i) => {
    const who = [r.department, r.level && `${r.level}L`].filter(Boolean).join(' ');
    return `${medal[i] || `${i + 1}.`} ${r.username} - ${r.points}/${r.possible}${who ? ` (${who})` : ''}`;
  });
  const deptLines = depts.map((d, i) => `${i + 1}. ${d.name} - ${d.avg}% avg`);
  const text = [
    `🏆 ${course} Top 10 (${date})`,
    '',
    ...lines,
    ...(deptLines.length ? ['', '🏫 Top departments', ...deptLines] : []),
    '',
    `Think you can beat them? Try the sets and join the board: ${url.origin}/leaderboard/${encodeURIComponent(course)}`,
  ].join('\n');
  return NextResponse.json({ text });
}
