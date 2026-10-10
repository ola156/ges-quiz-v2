import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { db } from '../../../../lib/supabase';
import { isAdmin } from '../../../../lib/admin';

const deny = () => NextResponse.json({ error: 'Wrong password' }, { status: 401 });
const fail = (msg, status = 400) => NextResponse.json({ error: msg }, { status });
const clean = (v, n) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, n) : null);
const refresh = () => {
  revalidateTag('quizzes');
  revalidateTag('boards');
};

// Lowercase letters, numbers and single hyphens. "Chem 101" becomes "chem-101".
const normCode = (s) =>
  String(s || '').toLowerCase().trim().replace(/[\s_]+/g, '-').replace(/[^a-z0-9-]/g, '').replace(/-+/g, '-').replace(/^-|-$/g, '');
const CODE_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

const SELECT =
  'id, code, title, description, published, creator_id, created_at, creators(name), quizzes(id, slug, title, published, created_at, questions(count), submissions(count))';

function shape(c) {
  return {
    ...c,
    quizzes: (c.quizzes || [])
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
      .map((q) => ({
        id: q.id, slug: q.slug, title: q.title, published: q.published,
        questionCount: q.questions?.[0]?.count ?? 0,
        submissionCount: q.submissions?.[0]?.count ?? 0,
      })),
  };
}

// A code word must be unique across collections, and must not equal any quiz code.
async function codeProblem(supabase, code, selfId) {
  if (code.length < 3 || code.length > 30 || !CODE_RE.test(code))
    return 'The code word must be 3 to 30 letters, numbers or hyphens.';
  const { data: q } = await supabase.from('quizzes').select('id').eq('slug', code).maybeSingle();
  if (q) return 'That code is already used by a quiz. Pick another word.';
  const { data: c } = await supabase.from('collections').select('id').eq('code', code).maybeSingle();
  if (c && c.id !== selfId) return 'That code word is already used by another collection.';
  return null;
}

export async function GET(req) {
  if (!isAdmin(req)) return deny();
  const { data, error } = await db().from('collections').select(SELECT).order('created_at', { ascending: false });
  if (error) return fail(error.message, 500);
  return NextResponse.json({ collections: (data || []).map(shape) });
}

export async function POST(req) {
  if (!isAdmin(req)) return deny();
  const body = await req.json();
  const code = normCode(body.code);
  const title = clean(body.title, 80);
  if (!title) return fail('Title is required');
  const supabase = db();
  const problem = await codeProblem(supabase, code, null);
  if (problem) return fail(problem);

  const { data, error } = await supabase
    .from('collections')
    .insert({ code, title, description: clean(body.description, 300), creator_id: body.creatorId || null })
    .select(SELECT)
    .single();
  if (error) return fail(error.code === '23505' ? 'That code word is already used.' : error.message, 500);
  refresh();
  return NextResponse.json({ collection: shape(data) });
}

export async function PATCH(req) {
  if (!isAdmin(req)) return deny();
  const body = await req.json();
  if (!body.id) return fail('Missing collection');
  const supabase = db();
  const update = {};
  if ('published' in body) update.published = Boolean(body.published);
  if ('title' in body) {
    const title = clean(body.title, 80);
    if (!title) return fail('Title is required');
    update.title = title;
  }
  if ('description' in body) update.description = clean(body.description, 300);
  if ('creator_id' in body) update.creator_id = body.creator_id || null;
  if ('code' in body) {
    const code = normCode(body.code);
    const problem = await codeProblem(supabase, code, body.id);
    if (problem) return fail(problem);
    update.code = code;
  }
  const { error } = await supabase.from('collections').update(update).eq('id', body.id);
  if (error) return fail(error.code === '23505' ? 'That code word is already used.' : error.message, 500);
  refresh();
  return NextResponse.json({ ok: true });
}

export async function DELETE(req) {
  if (!isAdmin(req)) return deny();
  const { id } = await req.json();
  // The sets stay as ordinary private sets, each with its own code.
  const { error } = await db().from('collections').delete().eq('id', id);
  if (error) return fail(error.message, 500);
  refresh();
  return NextResponse.json({ ok: true });
}