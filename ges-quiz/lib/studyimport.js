import { db } from './supabase';
import { parseStudy } from './studyparse';

const EXAMS = ['jamb', 'post_utme', 'university'];
const str = (v, n) => (typeof v === 'string' ? v.trim().slice(0, n) : '');
const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50) || 'subject';
const same = (a, b) => String(a).trim().toLowerCase() === String(b).trim().toLowerCase();

// Adds many lessons at once. For each lesson it finds the subject and the topic (by name) or makes them,
// then adds the lesson unless one with the same title is already in that topic, so running it twice is safe.
// dryRun reports what would happen and writes nothing.
export async function importLessons(list, { dryRun = false, published = false } = {}) {
  const results = [];
  const subjectIds = new Set();
  const subjects = new Map(); // exam|slug -> { id }
  const topics = new Map(); // subject id -> [{ id, title }]
  const lessons = new Map(); // topic id -> [{ title }]
  const subjPos = new Map(); // exam -> next position
  const topicPos = new Map(); // subject id -> next position
  const lessonPos = new Map(); // topic id -> next position
  const client = db();

  async function nextOf(cache, key, table, col) {
    if (!cache.has(key)) {
      const { data } = await client.from(table).select('position').eq(col, key).order('position', { ascending: false }).limit(1);
      cache.set(key, (data?.[0]?.position ?? -1) + 1);
    }
    const n = cache.get(key);
    cache.set(key, n + 1);
    return n;
  }

  for (const l of list) {
    const title = str(l?.title, 120);
    const row = { title, topic: str(l?.topic, 120) };
    try {
      const exam = str(l?.exam, 20);
      const sName = str(l?.subject, 80);
      if (!EXAMS.includes(exam)) throw new Error('Unknown level');
      if (!sName || !row.topic || !title) throw new Error('Subject, topic and lesson title are all needed');
      if (typeof l.content !== 'string' || l.content.length > 80000) throw new Error('Lesson text is missing or too long');
      const parsed = parseStudy(l.content);
      if (parsed.errors.length) throw new Error(parsed.errors[0]);
      if (!parsed.cards.length) throw new Error('No cards');

      // subject
      const slug = slugify(sName);
      const sKey = `${exam}|${slug}`;
      if (!subjects.has(sKey)) {
        const { data: found } = await client.from('study_subjects').select('id').eq('exam', exam).eq('slug', slug).maybeSingle();
        subjects.set(sKey, found ? { id: found.id } : { id: null });
      }
      let subj = subjects.get(sKey);
      if (!subj.id && !dryRun) {
        const { data, error } = await client.from('study_subjects').insert({
          exam, school: null, slug, name: sName, blurb: '', published, position: await nextOf(subjPos, exam, 'study_subjects', 'exam'),
        }).select('id').single();
        if (error) throw new Error(error.message);
        subj = { id: data.id };
        subjects.set(sKey, subj);
      }
      if (subj.id) subjectIds.add(subj.id);

      // topic
      let topic = null;
      if (subj.id) {
        if (!topics.has(subj.id)) {
          const { data } = await client.from('study_topics').select('id, title').eq('subject_id', subj.id);
          topics.set(subj.id, data || []);
        }
        topic = topics.get(subj.id).find((t) => same(t.title, row.topic)) || null;
        if (!topic && !dryRun) {
          const { data, error } = await client.from('study_topics').insert({
            subject_id: subj.id, title: row.topic, position: await nextOf(topicPos, subj.id, 'study_topics', 'subject_id'),
          }).select('id, title').single();
          if (error) throw new Error(error.message);
          topic = { id: data.id, title: row.topic };
          topics.get(subj.id).push(topic);
        }
      }

      // lesson
      if (topic) {
        if (!lessons.has(topic.id)) {
          const { data } = await client.from('study_subtopics').select('title').eq('topic_id', topic.id);
          lessons.set(topic.id, data || []);
        }
        if (lessons.get(topic.id).some((x) => same(x.title, title))) {
          results.push({ ...row, status: 'skipped', message: 'Already there' });
          continue;
        }
      }
      if (dryRun) {
        results.push({ ...row, status: 'would add' });
        continue;
      }
      const { data, error } = await client.from('study_subtopics').insert({
        topic_id: topic.id, title, cards: parsed.cards, questions: parsed.questions, published,
        position: await nextOf(lessonPos, topic.id, 'study_subtopics', 'topic_id'),
      }).select('id').single();
      if (error) throw new Error(error.message);
      lessons.get(topic.id).push({ title });
      results.push({ ...row, status: 'added', id: data.id });
    } catch (e) {
      results.push({ ...row, status: 'error', message: e.message || 'Could not save' });
    }
  }
  return { results, subjectIds: [...subjectIds] };
}