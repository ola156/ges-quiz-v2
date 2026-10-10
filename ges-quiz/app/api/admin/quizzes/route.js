import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { db } from '../../../../lib/supabase';
import { isAdmin } from '../../../../lib/admin';

const deny = () => NextResponse.json({ error: 'Wrong password' }, { status: 401 });

// Pages are cached for speed, so clear them whenever the admin changes something.
const refresh = () => {
  revalidateTag('quizzes');
  revalidateTag('boards');
};

const slugify = (s) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50) || 'quiz';

// Private codes: 8 characters, no look-alikes (no 0/o, 1/l/i), easy to type from WhatsApp.
const CODE_CHARS = 'abcdefghjkmnpqrstuvwxyz23456789';
const makeCode = () =>
  Array.from({ length: 8 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');

const toLimit = (v) => {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 && n <= 300 ? n : null;
};

const toImage = (v) => (typeof v === 'string' && /^https:\/\//.test(v) && v.length < 600 ? v : null);

export async function GET(req) {
  if (!isAdmin(req)) return deny();
  const { data: quizzes, error } = await db()
    .from('quizzes')
    .select('id, slug, title, course, published, listed, allow_calculator, collection_id, time_limit_minutes, created_at, creators(name), collections(code, title), questions(count), submissions(count)')
    .order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({
    quizzes: quizzes.map((q) => ({
      ...q,
      questionCount: q.questions?.[0]?.count ?? 0,
      submissionCount: q.submissions?.[0]?.count ?? 0,
    })),
  });
}

export async function POST(req) {
  if (!isAdmin(req)) return deny();
  const { title, course, description, timeLimit, questions, kind, creatorId, collectionId, allowCalculator } = await req.json();
  if (!title?.trim()) return NextResponse.json({ error: 'Title is required' }, { status: 400 });
  if (!Array.isArray(questions) || !questions.length)
    return NextResponse.json({ error: 'No questions to save' }, { status: 400 });

  const isPrivate = kind === 'private';
  const supabase = db();

  // A set can join a collection only if it is private, and the collection must exist.
  let collection = null;
  if (isPrivate && collectionId) {
    const { data } = await supabase.from('collections').select('id, code, title').eq('id', collectionId).maybeSingle();
    if (!data) return NextResponse.json({ error: 'That collection no longer exists' }, { status: 400 });
    collection = data;
  }

  const base = {
    title: title.trim(),
    description: description?.trim() || null,
    time_limit_minutes: toLimit(timeLimit),
    allow_calculator: Boolean(allowCalculator),
    // A private set never joins a course, so its scores can never reach a public leaderboard.
    course: isPrivate ? null : course?.trim() || null,
    listed: !isPrivate,
    // In a collection, the creator card comes from the collection itself.
    creator_id: isPrivate && !collection && creatorId ? creatorId : null,
    collection_id: collection ? collection.id : null,
  };

  let quiz = null;
  let lastError = null;
  for (let tries = 0; tries < 6 && !quiz; tries++) {
    // Private sets get a random code with no title in it. Public sets keep the readable slug.
    const slug = isPrivate ? makeCode() : `${slugify(title)}-${Math.random().toString(36).slice(2, 6)}`;
    const { data, error } = await supabase.from('quizzes').insert({ ...base, slug }).select().single();
    if (!error) { quiz = data; break; }
    lastError = error;
    if (error.code !== '23505') break;
  }
  if (!quiz) return NextResponse.json({ error: lastError?.message || 'Could not save' }, { status: 500 });

  const rows = questions.map((q, i) => ({
    quiz_id: quiz.id,
    position: i + 1,
    text: q.text,
    options: q.options,
    answer: q.answer,
    explanation: q.explanation,
    image_url: toImage(q.image_url),
  }));
  const { error: qErr } = await supabase.from('questions').insert(rows);
  if (qErr) {
    await supabase.from('quizzes').delete().eq('id', quiz.id);
    return NextResponse.json({ error: qErr.message }, { status: 500 });
  }
  refresh();
  return NextResponse.json({
    slug: quiz.slug,
    listed: quiz.listed,
    collection: collection ? { code: collection.code, title: collection.title } : null,
  });
}

export async function PATCH(req) {
  if (!isAdmin(req)) return deny();
  const body = await req.json();
  const supabase = db();
  const update = {};
  if ('published' in body) update.published = Boolean(body.published);
  if ('time_limit_minutes' in body) update.time_limit_minutes = toLimit(body.time_limit_minutes);
  if ('allow_calculator' in body) update.allow_calculator = Boolean(body.allow_calculator);
  if ('collection_id' in body) {
    if (body.collection_id) {
      const { data: cur } = await supabase.from('quizzes').select('listed').eq('id', body.id).maybeSingle();
      if (!cur || cur.listed) return NextResponse.json({ error: 'Only private sets can join a collection.' }, { status: 400 });
      const { data: col } = await supabase.from('collections').select('id').eq('id', body.collection_id).maybeSingle();
      if (!col) return NextResponse.json({ error: 'That collection no longer exists' }, { status: 400 });
      update.collection_id = col.id;
    } else {
      update.collection_id = null;
    }
  }
  const { error } = await supabase.from('quizzes').update(update).eq('id', body.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  refresh();
  return NextResponse.json({ ok: true });
}

export async function DELETE(req) {
  if (!isAdmin(req)) return deny();
  const { id } = await req.json();
  const { error } = await db().from('quizzes').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  refresh();
  return NextResponse.json({ ok: true });
}