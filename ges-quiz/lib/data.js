import { unstable_cache } from 'next/cache';
import { db } from './supabase';
import { getSetBoard, getCourseBoard, getDeptBoard, getCollectionBoard } from './leaderboard';

// Cached reads, so opening a page does not wait on the database every time.
// Admin changes clear 'quizzes' straight away, and every submission clears 'boards'.

// Public list only. Private sets (listed = false) never appear here.
export const getPublishedQuizzes = unstable_cache(
  async () => {
    const { data } = await db()
      .from('quizzes')
      .select('slug, title, course, description, time_limit_minutes, questions(count)')
      .eq('published', true)
      .eq('listed', true)
      .order('created_at', { ascending: false });
    return data || [];
  },
  ['published-quizzes'],
  { revalidate: 60, tags: ['quizzes'] },
);

// Works for public and private sets, because a private link is just its slug.
// The answer column is never selected, so it is never sent to the browser.
export const getQuizBySlug = unstable_cache(
  async (slug) => {
    const supabase = db();
    const { data: quiz } = await supabase
      .from('quizzes')
      .select('id, title, course, description, time_limit_minutes, listed, allow_calculator, creators(name, post, agenda, photo_url, logo_url), collections(code, title, creators(name, post, agenda, photo_url, logo_url))')
      .eq('slug', slug)
      .eq('published', true)
      .maybeSingle();
    if (!quiz) return null;
    // A set inside a collection shows the collection's creator card, unless it has its own.
    if (!quiz.creators && quiz.collections?.creators) quiz.creators = quiz.collections.creators;
    quiz.collections = quiz.collections ? { code: quiz.collections.code, title: quiz.collections.title } : null;
    const { data: questions } = await supabase
      .from('questions').select('id, text, options, image_url').eq('quiz_id', quiz.id).order('position');
    return { quiz, questions: questions || [] };
  },
  ['quiz-by-slug'],
  { revalidate: 60, tags: ['quizzes'] },
);

export const getSetBoardCached = unstable_cache(
  async (quizId) => getSetBoard(db(), quizId, 10),
  ['set-board'],
  { revalidate: 30, tags: ['boards'] },
);

export const getCourseTopCached = unstable_cache(
  async (course) => getCourseBoard(db(), course, 3),
  ['course-top3'],
  { revalidate: 30, tags: ['boards'] },
);

// Everyone who took part in a course, for the full leaderboard page.
export const getCourseFullCached = unstable_cache(
  async (course) => getCourseBoard(db(), course, Infinity),
  ['course-full'],
  { revalidate: 30, tags: ['boards'] },
);

export const getDeptBoardCached = unstable_cache(
  async (course) => getDeptBoard(db(), course, 20),
  ['course-depts'],
  { revalidate: 30, tags: ['boards'] },
);

// One subject: its details, creator card and sets. Found by the code word.
export const getCollectionByCode = unstable_cache(
  async (code) => {
    const supabase = db();
    const { data: col } = await supabase
      .from('collections')
      .select('id, code, title, description, creators(name, post, agenda, photo_url, logo_url, code)')
      .eq('code', String(code || '').toLowerCase())
      .eq('published', true)
      .maybeSingle();
    if (!col) return null;
    const { data: sets } = await supabase
      .from('quizzes')
      .select('slug, title, description, time_limit_minutes, questions(count), submissions(count)')
      .eq('collection_id', col.id)
      .eq('published', true)
      .order('created_at', { ascending: true });
    return { ...col, sets: sets || [] };
  },
  ['collection-by-code'],
  { revalidate: 60, tags: ['quizzes', 'boards'] },
);

export const getCollectionBoardCached = unstable_cache(
  async (collectionId) => getCollectionBoard(db(), collectionId, Infinity),
  ['collection-board'],
  { revalidate: 30, tags: ['boards'] },
);

// A creator's page: their card, every published course (collection) and any loose private sets.
export const getCreatorByCode = unstable_cache(
  async (code) => {
    const supabase = db();
    const { data: creator } = await supabase
      .from('creators')
      .select('id, name, post, agenda, photo_url, logo_url, code')
      .eq('code', String(code || '').toLowerCase())
      .maybeSingle();
    if (!creator) return null;

    const { data: cols } = await supabase
      .from('collections')
      .select('code, title, description, created_at, quizzes(id, published, questions(count))')
      .eq('creator_id', creator.id)
      .eq('published', true)
      .order('created_at', { ascending: true });
    const courses = (cols || []).map((c) => {
      const live = (c.quizzes || []).filter((q) => q.published);
      return {
        code: c.code,
        title: c.title,
        description: c.description,
        sets: live.length,
        questions: live.reduce((n, q) => n + (q.questions?.[0]?.count ?? 0), 0),
      };
    });

    const { data: loose } = await supabase
      .from('quizzes')
      .select('slug, title, description, time_limit_minutes, questions(count)')
      .eq('creator_id', creator.id)
      .is('collection_id', null)
      .eq('listed', false)
      .eq('published', true)
      .order('created_at', { ascending: true });

    return { ...creator, courses, loose: loose || [] };
  },
  ['creator-by-code'],
  { revalidate: 60, tags: ['quizzes', 'boards'] },
);