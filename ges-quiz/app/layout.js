import { Arima, Space_Mono } from 'next/font/google';
import './globals.css';
import { BRAND } from '../lib/brand';

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
  title: `${BRAND} | Practice quizzes for UI students`,
  description:
    'Free practice quizzes for University of Ibadan students: GES, GST and more. Instant corrections and leaderboards. No sign-up needed.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={`${arima.variable} ${mono.variable}`}>
        <main className="wrap">{children}</main>
      </body>
    </html>
  );
}