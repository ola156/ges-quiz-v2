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


if i click on the nav bar in the tutor part it dosent work and i want result to be separate from the create the result should be well written and for the case of something like jamb that is over 400 it should be calculated to the result page should be detailed and i dont want profile to be taking me back to onboarding do a simple profile page and when i clicked on exam/id it was not responsive i also want all the created quiz to be in its own part off the dashboard with an edit or manage button only the top or newest should show up on the main dashboard page and dont add it under in that part i am creating them and also all these things will be too much for a footbar so do a separate sidebar that retracts too for small screen and keep just 4 of the nav in the foot bar thet shoulf b menu on small screens too the admin tutor ans student 

the exam mode dosent have timer i should be able to set one and if i click on a card it darken and i dont see what is there anymore also the number like progress should show under in boxes with the numbers that indicates done and other stuff


i dont want that practice to go to that other stuff again the practice set should just go to a page that shows all the public quizez people can take and temember it is dependent on the stuff chosen during onboarding so it should still remain in the main application change the style add a search bar dont make it like it was before and remove that old application interface those code stuff should still work i just dont want that /browse app again all the content that is public efore should enter the public pool in the student side of the application 

the main student dashboard home should show the progress like what the person is reading and stopped and remove that stuff that says change your univesity or somthing it is ment to be in the profile and make th university and department better just restyle the interfce and the code box too restyle everthing oyu dont havr to put it in that card 

for the admin part remove the creator fom the frontend but dont delete it yet and add somethigg to nanage student accounts too i also want all the created quiz to be in its own part of the admin page all note should be in thier own page too and dont add it under in that part i am creating them and also all these things will be too much for a footbar so do a separate sidebar that retracts too for small screen and keep just 4 of the nav in the foot bar thet should be a menu on small screens too the admin tutor ans student 