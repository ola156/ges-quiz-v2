-- Run this only if you already ran the first schema.sql.
alter table quizzes add column if not exists time_limit_minutes int;
alter table submissions add column if not exists username text;
alter table submissions add column if not exists client_id text;
alter table submissions add column if not exists time_taken int;

create index if not exists submissions_client_idx on submissions(client_id);
create index if not exists submissions_username_idx on submissions(username);

create or replace view best_attempts as
select distinct on (s.quiz_id, coalesce(s.client_id, s.username))
  s.quiz_id,
  coalesce(s.client_id, s.username) as user_key,
  s.username, s.department, s.level, s.score, s.total,
  coalesce(s.time_taken, 999999) as time_taken
from submissions s
where s.username is not null
order by s.quiz_id, coalesce(s.client_id, s.username), s.score desc, coalesce(s.time_taken, 999999) asc;

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
from best_attempts b
join quizzes q on q.id = b.quiz_id
where q.published and q.course is not null
group by lower(trim(q.course)), b.user_key;

revoke all on best_attempts, course_board from anon, authenticated;
