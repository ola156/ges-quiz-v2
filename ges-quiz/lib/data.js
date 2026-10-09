import { unstable_cache } from 'next/cache';
import { db } from './supabase';
import { getSetBoard, getCourseBoard, getDeptBoard } from './leaderboard';

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
      .select('id, title, course, description, time_limit_minutes, listed, creators(name, post, agenda, photo_url, logo_url)')
      .eq('slug', slug)
      .eq('published', true)
      .maybeSingle();
    if (!quiz) return null;
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