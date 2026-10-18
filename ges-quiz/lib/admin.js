import { createHash, timingSafeEqual } from 'crypto';

// Compares hashes of both values so the check takes the same time whatever is typed.
const digest = (v) => createHash('sha256').update(String(v)).digest();

export function isAdmin(req) {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return false;
  const given = req.headers.get('x-admin-password') || '';
  return timingSafeEqual(digest(given), digest(expected));
}
