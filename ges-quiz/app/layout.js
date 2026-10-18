import { Arima, Space_Mono } from 'next/font/google';
import { ClerkProvider } from '@clerk/nextjs';
import './globals.css';
import { BRAND } from '../lib/brand';
import Shell from '../components/Shell';

const arima = Arima({
  subsets: ['latin'],
  variable: '--font-body',
});
const mono = Space_Mono({
  subsets: ['latin'],
  weight: ['400', '700'],
  variable: '--font-mono',
});

export const metadata = {
  title: `${BRAND} | Practice for JAMB, WAEC, Post-UTME and university exams`,
  description:
    'Free practice quizzes with instant corrections and leaderboards. Open a quiz with a code or a link, no account needed. Tutors can run timed mock exams for a whole class.',
};

// Sets the saved light or dark choice before the page paints, so it never flashes the wrong colours.
const THEME_BOOT = `try{var t=localStorage.getItem('theme');if(t==='light'||t==='dark')document.documentElement.setAttribute('data-theme',t)}catch(e){}`;

// The Clerk boxes are always white. Clerk picks its text colours from the page's light or dark setting,
// so in dark mode it chose light text for a white box. Inside Clerk the page is told to be light,
// and the page's own heading and label colours are set back to dark.
const CLERK_FIX = `
.cl-rootBox, .cl-card, .cl-modalContent, .cl-userButtonPopoverCard {
  color-scheme: light;
  --head: #1f2937; --on-dark: #1f2937; --on-dark-muted: #6b7280; --link: #4f46e5; --ink: #1f2937; --muted: #6b7280;
  color: #1f2937;
}
.cl-rootBox h1, .cl-rootBox h2, .cl-rootBox label, .cl-userButtonPopoverCard h1, .cl-userButtonPopoverCard h2, .cl-userButtonPopoverCard label { color: #1f2937; }
`;

const clerkLook = {
  variables: {
    colorPrimary: '#4f46e5',
    colorPrimaryForeground: '#ffffff',
    colorBackground: '#ffffff',
    colorForeground: '#1f2937',
    colorMutedForeground: '#6b7280',
    colorInput: '#ffffff',
    colorInputForeground: '#1f2937',
    colorNeutral: '#1f2937',
    colorBorder: '#e5e7eb',
    colorShimmer: 'rgba(255, 255, 255, 0.36)',
    // The same colours under the older names, for older Clerk versions.
    colorText: '#1f2937',
    colorTextSecondary: '#6b7280',
    colorInputBackground: '#ffffff',
    colorInputText: '#1f2937',
    borderRadius: '12px',
    fontFamily: 'Arima, system-ui, sans-serif',
  },
  elements: { card: { boxShadow: '0 1px 2px rgba(17,24,39,.04), 0 4px 14px rgba(17,24,39,.06)' } },
};

export default function RootLayout({ children }) {
  return (
    <ClerkProvider appearance={clerkLook}>
      <html lang="en" suppressHydrationWarning>
        <head>
          <script dangerouslySetInnerHTML={{ __html: THEME_BOOT }} />
          <style dangerouslySetInnerHTML={{ __html: CLERK_FIX }} />
        </head>
        <body className={`${arima.variable} ${mono.variable}`}>
          <Shell>{children}</Shell>
        </body>
      </html>
    </ClerkProvider>
  );
}