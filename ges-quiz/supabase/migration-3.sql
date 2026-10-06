-- Run this once in the Supabase SQL editor (after schema.sql / migration-2.sql).
-- 1. Leaderboards now rank each person's FIRST attempt on a set (retakes are practice).
-- 2. Submissions made after the time limit are flagged and left off the leaderboard.
alter table submissions add column if not exists late boolean not null default false;

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

drop view if exists best_attempts;
revoke all on ranked_attempts, course_board from anon, authenticated;
