import { NextResponse } from 'next/server';
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

// Only these need an account. Everything else (code box, quiz links, leaderboards, the
// admin page with its own password) stays open exactly as before.
const needsAccount = createRouteMatcher(['/onboarding(.*)', '/dashboard(.*)', '/api/me(.*)', '/api/tutor(.*)', '/study(.*)', '/api/study(.*)', '/profile(.*)']);

export default clerkMiddleware(async (auth, req) => {
  if (needsAccount(req)) await auth.protect();
  const res = NextResponse.next();
  res.headers.set('X-Content-Type-Options', 'nosniff');
  res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.headers.set('X-Frame-Options', 'SAMEORIGIN');
  res.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  return res;
});

export const config = {
  matcher: [
    // Skip Next.js internals and static files, always run for API routes.
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
};