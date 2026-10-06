# Instrict Quizmate (GES quiz)

## Setup
1. Create a Supabase project, open the SQL editor, run `supabase/schema.sql`.
   - Already ran an older version? Run `supabase/migration-2.sql` (if you never did) and then `supabase/migration-3.sql`.
2. Copy `.env.example` to `.env.local` and fill it in (Supabase URL, service role key, admin password, creator group link).
3. `npm install` then `npm run dev`.
4. Go to `/admin`, log in, paste questions, set the timer, publish.
5. Deploy on Vercel and add the same four env vars in the project settings.

## How ranking works
- Each person's FIRST attempt on a set counts. Retakes are practice and never change the board.
- Time is measured by the server from a signed start token. Submitting more than a minute after the limit is left off the board.
- Set board: best scores in one set (ties go to the faster finisher).
- Course board: first-attempt scores added up across all sets that share a course name.
- Department board: average percentage per department, minimum 3 students (change `MIN_DEPT` in `lib/leaderboard.js`).
- Questions and options are shuffled per attempt. "All of the above" style questions keep their option order.
- Progress is saved on the device, so a refresh does not lose the attempt.

## Sharing
- "Share my score card" makes a branded image at `/api/card` and opens the phone's share sheet (downloads it on desktop).
- Admin has a "Copy top 10 post" button per course for pasting into WhatsApp groups.
