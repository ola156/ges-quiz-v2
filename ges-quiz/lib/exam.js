import { cleanText } from './guard';
import { normCode } from './codes';

export const LIMITS = { subjects: 12, questions: 300 };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// open | scheduled (not yet) | closed. A quiz with no times is always open, like before.
export function examState(q, now = Date.now()) {
  const o = q.opens_at ? Date.parse(q.opens_at) : null;
  const c = q.closes_at ? Date.parse(q.closes_at) : null;
  if (c !== null && now >= c) return 'closed';
  if (o !== null && now < o) return 'scheduled';
  return 'open';
}

// Nigerian time, because that is where tutors and students are.
export function lagos(iso) {
  if (!iso) return '';
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Lagos', weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true,
  }).format(new Date(iso));
}

const toDate = (v) => {
  if (v === null || v === undefined || v === '') return { ok: true, value: null };
  const t = Date.parse(v);
  return Number.isFinite(t) ? { ok: true, value: new Date(t).toISOString() } : { ok: false };
};

const toLimit = (v) => {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 && n <= 300 ? n : null;
};

// Minutes allowed. One fixed time wins. Otherwise it is the minutes of the subjects the student is taking
// (all subjects when `chosen` is null). 0 means no timer.
export function examMinutes(quiz, chosen = null) {
  if (quiz.time_limit_minutes) return quiz.time_limit_minutes;
  const cfg = quiz.subject_config || {};
  const names = Array.isArray(chosen) ? chosen : Object.keys(cfg);
  return names.reduce((n, k) => n + (Number(cfg[k]?.minutes) || 0), 0);
}

const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

// Checks everything a tutor sends when saving an exam. Returns { error } or { value }.
export function cleanExam(body) {
  const title = cleanText(body.title, 120);
  if (!title) return { error: 'Give the exam a title.' };

  const opens = toDate(body.opensAt);
  const closes = toDate(body.closesAt);
  if (!opens.ok || !closes.ok) return { error: 'One of the dates is not valid.' };
  if (opens.value && closes.value && Date.parse(opens.value) >= Date.parse(closes.value))
    return { error: 'The closing time must be after the opening time.' };

  const subjectsIn = Array.isArray(body.subjects) ? body.subjects : [];
  if (!subjectsIn.length) return { error: 'Add at least one subject with questions.' };
  if (subjectsIn.length > LIMITS.subjects) return { error: `Use ${LIMITS.subjects} subjects or fewer.` };

  const multi = subjectsIn.length > 1;
  const pick = multi && body.pickSubjects === true;
  const fixed = toLimit(body.timeLimit);
  const seen = new Set();
  const config = {};
  const questions = [];
  for (let s = 0; s < subjectsIn.length; s++) {
    const name = cleanText(subjectsIn[s]?.name, 60);
    if (multi && !name) return { error: `Subject ${s + 1} needs a name.` };
    if (multi) {
      if (seen.has(name.toLowerCase())) return { error: `"${name}" is used twice. Give each subject its own name.` };
      seen.add(name.toLowerCase());
      config[name] = { required: pick && subjectsIn[s]?.required === true, minutes: fixed ? null : toLimit(subjectsIn[s]?.minutes) };
    }
    const list = Array.isArray(subjectsIn[s]?.questions) ? subjectsIn[s].questions : [];
    if (!list.length) return { error: `${name || 'Your subject'} has no questions.` };
    for (let n = 0; n < list.length; n++) {
      const q = list[n];
      const where = `${multi ? name + ', ' : ''}question ${n + 1}`;
      const text = str(q?.text, 1500);
      if (!text) return { error: `${where}: the question is empty.` };
      const options = Array.isArray(q?.options) ? q.options.map((o) => str(o, 400)) : [];
      if (options.length < 2 || options.length > 5 || options.some((o) => !o))
        return { error: `${where}: needs 2 to 5 options, none empty.` };
      if (!Number.isInteger(q.answer) || q.answer < 0 || q.answer >= options.length)
        return { error: `${where}: pick the correct answer.` };
      questions.push({
        id: typeof q.id === 'string' && UUID.test(q.id) ? q.id : null,
        subject: multi ? name : name || null,
        text,
        options,
        answer: q.answer,
        explanation: str(q.explanation, 1500) || null,
      });
    }
  }
  if (questions.length > LIMITS.questions) return { error: `Use ${LIMITS.questions} questions or fewer in one exam.` };

  // Rules for the "students pick their subjects" option and for time given per subject.
  let maxSubjects = null;
  if (multi) {
    const names = Object.keys(config);
    const required = names.filter((n) => config[n].required).length;
    if (pick) {
      if (required === names.length) return { error: 'Every subject is compulsory, so students have nothing to pick. Untick some, or turn the picker off.' };
      const m = Number(body.maxSubjects);
      if (body.maxSubjects !== null && body.maxSubjects !== '' && body.maxSubjects !== undefined) {
        if (!Number.isInteger(m) || m < 1) return { error: 'The most subjects a student can pick must be a whole number, 1 or more.' };
        if (m < required) return { error: `${required} subjects are compulsory, so the limit cannot be lower than ${required}.` };
        if (m < names.length) maxSubjects = m;
      }
    }
    const timed = names.filter((n) => config[n].minutes).length;
    if (!fixed && timed && timed < names.length) return { error: 'Give every subject its minutes, or leave all of them empty.' };
  }

  const code = body.code ? normCode(body.code) : '';

  return {
    value: {
      quiz: {
        title,
        description: cleanText(body.description, 500),
        time_limit_minutes: fixed,
        pick_subjects: pick,
        max_subjects: maxSubjects,
        subject_config: multi ? config : null,
        opens_at: opens.value,
        closes_at: closes.value,
        show_score: body.showScore !== false,
        ask_department: Boolean(body.askDepartment),
        ask_level: Boolean(body.askLevel),
        allow_calculator: Boolean(body.allowCalculator),
      },
      questions,
      code,
    },
  };
}