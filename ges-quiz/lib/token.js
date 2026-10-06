import { createHmac, timingSafeEqual } from 'crypto';

// Stateless "quiz started" token. The server stamps the start time, so the timer
// cannot be paused or stretched from the browser.
const secret = () => process.env.SUPABASE_SERVICE_ROLE_KEY || 'dev-secret';
const sign = (payload) => createHmac('sha256', secret()).update(payload).digest('hex');

export function signStart(quizId, startedAt) {
  const payload = `${quizId}.${startedAt}`;
  return `${payload}.${sign(payload)}`;
}

// Returns the start time (ms) if the token is genuine and belongs to this quiz, else null.
export function readStart(token, quizId) {
  if (typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3 || parts[0] !== quizId) return null;
  const expected = Buffer.from(sign(`${parts[0]}.${parts[1]}`));
  const given = Buffer.from(parts[2]);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  const t = Number(parts[1]);
  return Number.isFinite(t) && t <= Date.now() + 5000 ? t : null;
}
