import { NextResponse } from 'next/server';
import { db } from '../../../../../../lib/supabase';
import { examState, lagos } from '../../../../../../lib/exam';
import { fail, ownExam, requireTutor } from '../../../../../../lib/tutor';
import { jambTotal, waecGrade } from '../../../../../../lib/grade';

const mmss = (s) => (s || s === 0 ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` : '');

// Spreadsheet programs run text that starts with = + - @ as a formula. A leading quote stops that.
const safe = (v) => {
  const s = String(v ?? '');
  return /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
};
const cell = (v) => `"${safe(v).replace(/"/g, '""')}"`;

export async function GET(req, { params }) {
  const who = await requireTutor(req);
  if (who.res) return who.res;
  const { id } = await params;
  const exam = await ownExam(who.userId, id, 'id, slug, title, track, opens_at, closes_at, ask_department, ask_level');
  if (!exam) return fail('Exam not found', 404);

  const supabase = db();
  const { data: rows, error } = await supabase
    .from('submissions')
    .select('name, department, level, score, total, time_taken, late, subject_scores, created_at')
    .eq('quiz_id', id)
    .order('created_at', { ascending: false })
    .limit(5000);
  if (error) return fail(error.message, 500);

  const results = (rows || []).map((r) => ({
    name: r.name,
    department: r.department || '',
    level: r.level || '',
    score: r.score,
    total: r.total,
    percent: r.total ? Math.round((r.score / r.total) * 100) : 0,
    time: r.time_taken,
    late: Boolean(r.late),
    subjects: r.subject_scores || null,
    at: r.created_at,
  }));

  if (new URL(req.url).searchParams.get('format') === 'csv') {
    // Students may have picked different subjects, so each row shows only the subjects that student took.
    const subjectNames = [...new Set(results.flatMap((r) => Object.keys(r.subjects || {})))];
    const jamb = exam.track === 'jamb' && subjectNames.length > 0;
    const waec = exam.track === 'waec';
    const head = ['Name', ...(exam.ask_department ? ['Department'] : []), ...(exam.ask_level ? ['Level'] : []),
      ...(jamb ? ['JAMB score', 'JAMB score out of'] : []), 'Score', 'Out of', 'Percent', ...subjectNames.map((s) => `${s} (score)`), ...(waec ? subjectNames.map((s) => `${s} (grade)`) : []), 'Time taken', 'Submitted', 'Note'];
    const lines = [head.map(cell).join(',')];
    for (const r of results) {
      lines.push([
        r.name, ...(exam.ask_department ? [r.department] : []), ...(exam.ask_level ? [r.level] : []),
        ...(jamb ? [jambTotal(r.subjects, subjectNames), 100 * Object.keys(r.subjects || {}).length] : []),
        r.score, r.total, `${r.percent}%`,
        ...subjectNames.map((s) => (r.subjects?.[s] ? `${r.subjects[s][0]}/${r.subjects[s][1]}` : '')),
        ...(waec ? subjectNames.map((s) => (r.subjects?.[s]?.[1] ? waecGrade(Math.round((r.subjects[s][0] / r.subjects[s][1]) * 100)) : '')) : []),
        mmss(r.time), lagos(r.at), r.late ? 'Not ranked (late or no start time)' : '',
      ].map(cell).join(','));
    }
    const file = (exam.title || 'exam').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').slice(0, 40) || 'exam';
    return new NextResponse('﻿' + lines.join('\r\n'), {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${file}-results.csv"`,
        'Cache-Control': 'no-store',
      },
    });
  }

  return NextResponse.json({ state: examState(exam), results }, { headers: { 'Cache-Control': 'no-store' } });
}
