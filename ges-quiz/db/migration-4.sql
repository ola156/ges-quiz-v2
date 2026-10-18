-- Run once in the Supabase SQL editor, after schema.sql / migration-2.sql / migration-3.sql.
-- Adds accounts for signed-in students and tutors. Sign-in itself is handled by Clerk;
-- these tables only hold what the app needs to know about each person.
-- Nothing existing is changed, so code-box and link quizzes keep working as before.

create table if not exists members (
  clerk_id text primary key,
  role text not null check (role in ('student', 'tutor')),
  email text,
  display_name text,
  track text check (track in ('jamb', 'waec', 'post_utme', 'university')),
  school text,
  department text,
  class_level text,
  centre text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint student_needs_track check (role <> 'student' or track is not null)
);

create table if not exists tutor_accounts (
  clerk_id text primary key references members(clerk_id) on delete cascade,
  active boolean not null default false,
  free_session_used boolean not null default false,
  activated_at timestamptz,
  created_at timestamptz not null default now()
);

-- Same rule as the rest of the app: nobody reads these from the browser.
-- All access goes through server routes that use the service role key.
alter table members enable row level security;
alter table tutor_accounts enable row level security;
revoke all on members, tutor_accounts from anon, authenticated;
