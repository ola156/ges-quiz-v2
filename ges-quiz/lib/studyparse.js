import { parseQuestions } from './parse';

// One paste box holds a whole lesson: the study cards, then a line that says QUIZ, then the questions.
//
//   ## Card title
//   - first point
//   - second point
//
//   ## Next card
//   - point
//
//   QUIZ
//   1. Question?
//   A. option
//   B. option
//   C. option
//   D. option
//   Answer: B
//   Explanation: why B is right.

export function parseStudy(raw) {
  const text = String(raw || '').replace(/\r/g, '');
  const split = text.split(/^\s*QUIZ\s*$/im);
  const cardText = split[0] || '';
  const quizText = split.slice(1).join('\n');
  const errors = [];

  const cards = [];
  let cur = null;
  for (const line of cardText.split('\n')) {
    const t = line.trim();
    if (!t) continue;
    const head = t.match(/^#{1,3}\s*(.+)$/);
    if (head) {
      cur = { t: head[1].replace(/\*\*/g, '').trim().slice(0, 80), p: [] };
      cards.push(cur);
      continue;
    }
    const point = t.replace(/^[-*•]\s+/, '').replace(/\*\*/g, '').trim();
    if (!point) continue;
    if (!cur) {
      cur = { t: 'Notes', p: [] };
      cards.push(cur);
    }
    // A line with no bullet right after a point is the rest of that point.
    if (/^[-*•]\s+/.test(t) || !cur.p.length) cur.p.push(point.slice(0, 600));
    else cur.p[cur.p.length - 1] += ' ' + point;
  }
  for (const c of cards) if (!c.p.length) errors.push(`The card "${c.t}" has no points.`);

  let questions = [];
  if (quizText.trim()) {
    const r = parseQuestions(quizText);
    questions = r.questions.map((q) => ({ q: q.text, o: q.options, a: q.answer, why: q.explanation || '' }));
    errors.push(...r.errors);
  }
  if (!cards.length && !questions.length) errors.push('Nothing to save yet. Add cards, then a QUIZ line, then questions.');
  return { cards, questions, errors };
}

// Turns saved content back into the paste format, so a lesson can be edited.
export function serializeStudy(cards = [], questions = []) {
  const L = 'ABCDE';
  const c = cards.map((x) => `## ${x.t}\n${x.p.map((p) => `- ${p}`).join('\n')}`).join('\n\n');
  const q = questions
    .map((x, i) => `${i + 1}. ${x.q}\n${x.o.map((o, k) => `${L[k]}. ${o}`).join('\n')}\nAnswer: ${L[x.a]}${x.why ? `\nExplanation: ${x.why}` : ''}`)
    .join('\n\n');
  return q ? `${c}\n\nQUIZ\n${q}` : c;
}

export const STUDY_PROMPT = `Write a short lesson on the topic I give you, for Nigerian students. Output only the lesson, with no intro, no closing text and no markdown other than the "##" headings and "-" bullets shown. Use exactly this format.

First write the appropriate amount of study cards for this . Each card has a "## " heading and a appropriate short bullet points that start with "- ". Keep each point to simple but still enough to understand.

Then write one line that says only QUIZ.

Then write 20 multiple choice questions in this format:

1. Question text here?
A. First option
B. Second option
C. Third option
D. Fourth option
Answer: B
Explanation: One short sentence on why B is correct.

Rules: number the questions from 1, give exactly 4 options, only one correct answer, and vary the position of the correct answer. For any maths, powers, fractions, roots, units or chemical formulas, write them in LaTeX between dollar signs, for example $x^2$, $\\frac{a}{b}$, $H_2O$, $m/s^2$. Never use the dollar sign for money, write naira or N instead.The goal is to make studying easier so make sure to explain well and dont leave out important point and follow the instruction strictly.`;