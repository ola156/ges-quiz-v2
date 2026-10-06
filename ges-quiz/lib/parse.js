// Parses pasted questions into structured data.
// Expected shape per question:
//   1. Question text
//   A. option
//   B. option
//   C. option
//   D. option
//   Answer: B
//   Explanation: optional text
export function parseQuestions(raw) {
  const lines = String(raw || '')
    .replace(/\r/g, '')
    .split('\n')
    .map((l) => l.replace(/\*\*/g, '').replace(/^[-*•]\s+/, '').trim())
    .filter(Boolean);

  const questions = [];
  const errors = [];
  let cur = null;
  let last = null; // 'q' | 'opt' | 'exp'
  let lastLetter = null;

  const finish = () => {
    if (!cur) return;
    const label = `Question ${cur.n}`;
    const letters = Object.keys(cur.opts).sort();
    const text = cur.text.trim();
    if (!text) return errors.push(`${label}: missing question text`);
    if (letters.length < 2) return errors.push(`${label}: needs at least 2 options`);
    if (cur.answer === null) return errors.push(`${label}: missing "Answer: X" line`);
    const answerIndex = letters.indexOf(cur.answer);
    if (answerIndex === -1) return errors.push(`${label}: answer ${cur.answer} does not match any option`);
    questions.push({
      text,
      options: letters.map((l) => cur.opts[l].trim()),
      answer: answerIndex,
      explanation: cur.explanation.trim() || null,
    });
  };

  for (const line of lines) {
    const ans = line.match(/^(?:answer|ans|correct(?:\s*answer)?)\s*[:\-]\s*\(?([A-Ea-e])\)?/i);
    const exp = line.match(/^(?:explanation|reason|rationale)\s*[:\-]\s*(.*)$/i);
    const opt = line.match(/^\(?([A-Ea-e])[.)\]:]\s*(.+)$/);
    const q = line.match(/^(?:question|q)?\s*(\d+)\s*[.):\-]\s*(.*)$/i);

    if (ans && cur) {
      cur.answer = ans[1].toUpperCase();
      last = null;
    } else if (exp && cur) {
      cur.explanation = exp[1];
      last = 'exp';
    } else if (opt && cur && cur.text) {
      lastLetter = opt[1].toUpperCase();
      cur.opts[lastLetter] = opt[2];
      last = 'opt';
    } else if (q) {
      finish();
      cur = { n: q[1], text: q[2], opts: {}, answer: null, explanation: '' };
      last = 'q';
    } else if (cur) {
      if (last === 'q') cur.text += ' ' + line;
      else if (last === 'opt') cur.opts[lastLetter] += ' ' + line;
      else if (last === 'exp') cur.explanation += ' ' + line;
    }
  }
  finish();

  if (!questions.length && !errors.length) errors.push('No questions found. Check the format.');
  return { questions, errors };
}

export const AI_PROMPT = `Read the attached lecture slides and write 20 multiple choice questions that test the key ideas. Output only the questions, with no intro, no closing text and no markdown. Use exactly this format for every question:

1. Question text here?
A. First option
B. Second option
C. Third option
D. Fourth option
Answer: B
Explanation: One short sentence on why B is correct.

Rules: number questions from 1, give exactly 4 options, only one correct answer, and vary the position of the correct answer.`;
