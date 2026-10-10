// Code words are shared by collections, creators and single private sets, so one word can only
// mean one thing. This keeps the rules in one place.

// "Chem 101" becomes "chem-101": lowercase letters, numbers and single hyphens.
export const normCode = (s) =>
  String(s || '').toLowerCase().trim().replace(/[\s_]+/g, '-').replace(/[^a-z0-9-]/g, '').replace(/-+/g, '-').replace(/^-|-$/g, '');

const CODE_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

// Returns a message if the code cannot be used, or null if it is fine.
// `self` lets a collection or creator keep its own code when it is edited.
export async function codeProblem(supabase, code, self = {}) {
  if (code.length < 3 || code.length > 30 || !CODE_RE.test(code))
    return 'The code word must be 3 to 30 letters, numbers or hyphens.';
  const [{ data: q }, { data: c }, { data: u }] = await Promise.all([
    supabase.from('quizzes').select('id').eq('slug', code).maybeSingle(),
    supabase.from('collections').select('id').eq('code', code).maybeSingle(),
    supabase.from('creators').select('id').eq('code', code).maybeSingle(),
  ]);
  if (q) return 'That code is already used by a quiz. Pick another word.';
  if (c && c.id !== self.collectionId) return 'That code word is already used by a collection.';
  if (u && u.id !== self.creatorId) return 'That code word is already used by a creator.';
  return null;
}