create extension if not exists pgcrypto;

create table if not exists quizzes (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  course text,
  description text,
  time_limit_minutes int,
  published boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists questions (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references quizzes(id) on delete cascade,
  position int not null,
  text text not null,
  options jsonb not null,
  answer int not null,
  explanation text
);

create table if not exists submissions (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references quizzes(id) on delete cascade,
  name text,
  username text,
  client_id text,
  department text,
  level text,
  whatsapp text,
  score int not null,
  total int not null,
  time_taken int,
  late boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists questions_quiz_idx on questions(quiz_id, position);
create index if not exists submissions_quiz_idx on submissions(quiz_id);
create index if not exists submissions_client_idx on submissions(client_id);
create index if not exists submissions_username_idx on submissions(username);

-- First attempt per person per set (a person is one browser, tracked by client_id).
-- Retakes are practice. Late submissions (after the timer) are left off.
create or replace view ranked_attempts as
select * from (
  select distinct on (s.quiz_id, coalesce(s.client_id, s.username))
    s.quiz_id,
    coalesce(s.client_id, s.username) as user_key,
    s.username, s.department, s.level, s.score, s.total,
    coalesce(s.time_taken, 999999) as time_taken,
    s.late
  from submissions s
  where s.username is not null
  order by s.quiz_id, coalesce(s.client_id, s.username), s.created_at asc
) first_try
where not late;

-- Overall course leaderboard: sum of first-attempt scores across all live sets of a course
create or replace view course_board as
select
  lower(trim(q.course)) as course_key,
  b.user_key,
  max(b.username) as username,
  max(b.department) as department,
  max(b.level) as level,
  sum(b.score)::int as points,
  sum(b.total)::int as possible,
  count(*)::int as sets_done,
  sum(b.time_taken)::int as total_time
from ranked_attempts b
join quizzes q on q.id = b.quiz_id
where q.published and q.course is not null
group by lower(trim(q.course)), b.user_key;

-- All access goes through server routes using the service role key.
alter table quizzes enable row level security;
alter table questions enable row level security;
alter table submissions enable row level security;
revoke all on ranked_attempts, course_board from anon, authenticated;
