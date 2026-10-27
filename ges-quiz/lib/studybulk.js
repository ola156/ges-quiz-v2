// Reads one text file that holds many lessons. Safe in the browser and on the server.
//
// Every lesson starts with a line   === LESSON ===
// then header lines, then the cards and the quiz exactly as you paste them one by one:
//
//   === LESSON ===
//   Level: JAMB
//   Subject: Use of English
//   Topic: Concord
//   Lesson: Subject and verb agreement
//
//   ## First card heading
//   - A point.
//
//   QUIZ
//   1. Question?
//   ...
const MARK = /^\s*={3,}\s*LESSON\s*={3,}\s*$/i;
const HEAD = /^\s*(level|exam|subject|topic|lesson|title)\s*:\s*(.*?)\s*$/i;

const LEVELS = {
  jamb: 'jamb',
  waec: 'jamb',
  'post-utme': 'post_utme',
  'post utme': 'post_utme',
  post_utme: 'post_utme',
  postutme: 'post_utme',
  university: 'university',
};

export function splitLessons(text) {
  const lines = String(text || '').replace(/\r/g, '').split('\n');
  const blocks = [];
  const errors = [];
  let cur = null;

  lines.forEach((line, i) => {
    if (MARK.test(line)) {
      cur = { line: i + 1, lines: [] };
      blocks.push(cur);
    } else if (cur) {
      cur.lines.push(line);
    } else if (line.trim()) {
      if (!errors.length) errors.push(`Line ${i + 1}: text before the first "=== LESSON ===" line was ignored.`);
    }
  });

  const lessons = [];
  blocks.forEach((b, n) => {
    const label = `Lesson ${n + 1} (line ${b.line})`;
    const head = {};
    let k = 0;
    for (; k < b.lines.length; k += 1) {
      const l = b.lines[k];
      if (!l.trim()) continue;
      const m = l.match(HEAD);
      if (!m) break;
      const key = m[1].toLowerCase();
      head[key === 'level' ? 'exam' : key === 'lesson' ? 'title' : key] = m[2];
    }
    const content = b.lines.slice(k).join('\n').trim();
    const exam = LEVELS[String(head.exam || '').trim().toLowerCase()];
    if (!exam) return errors.push(`${label}: Level must be JAMB, Post-UTME or University.`);
    if (!head.subject?.trim()) return errors.push(`${label}: missing "Subject:".`);
    if (!head.topic?.trim()) return errors.push(`${label}: missing "Topic:".`);
    if (!head.title?.trim()) return errors.push(`${label}: missing "Lesson:".`);
    if (!content) return errors.push(`${label} "${head.title}": no cards or quiz after the header.`);
    lessons.push({ exam, subject: head.subject.trim(), topic: head.topic.trim(), title: head.title.trim(), content, line: b.line });
  });

  if (!blocks.length && !errors.length) errors.push('No "=== LESSON ===" lines found. Check the file.');
  return { lessons, errors };
}