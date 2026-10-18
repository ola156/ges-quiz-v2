import { createHash, timingSafeEqual } from 'crypto';
import { auth } from '@clerk/nextjs/server';

// Who may use the admin area: the Clerk user ids listed in ADMIN_CLERK_IDS (comma separated).
// Nobody else gets in, however they sign up.
export function adminIds() {
  return String(process.env.ADMIN_CLERK_IDS || '').split(',').map((s) => s.trim()).filter(Boolean);
}

export async function isAdminUser() {
  const { userId } = await auth();
  return Boolean(userId && adminIds().includes(userId));
}

// Compares hashes of both values so the check takes the same time whatever is typed.
const digest = (v) => createHash('sha256').update(String(v)).digest();

// Used by every admin route. Sign-in comes from the browser cookie, so changes are only accepted
// from this site itself (a form on another website cannot act as you).
// The old shared password still works only if ADMIN_PASSWORD_FALLBACK is set to "on".
export async function isAdmin(req) {
  if (await isAdminUser()) {
    if (req.method === 'GET' || req.method === 'HEAD') return true;
    const origin = req.headers.get('origin');
    if (!origin) return false;
    try {
      return new URL(origin).host === req.headers.get('host');
    } catch {
      return false;
    }
  }
  const expected = process.env.ADMIN_PASSWORD;
  if (process.env.ADMIN_PASSWORD_FALLBACK === 'on' && expected) {
    const given = req.headers.get('x-admin-password') || '';
    return timingSafeEqual(digest(given), digest(expected));
  }
  return false;
}