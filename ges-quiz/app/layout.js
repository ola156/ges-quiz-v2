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

const clerkLook = {
  variables: {
    colorPrimary: '#4f46e5',
    colorBackground: '#ffffff',
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
        </head>
        <body className={`${arima.variable} ${mono.variable}`}>
          <Shell>{children}</Shell>
        </body>
      </html>
    </ClerkProvider>
  );
}
