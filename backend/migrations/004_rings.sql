-- Apple Fitness rings (Nov 8): Exercise ring (minutes) and Move ring (calories) promises. Safe to run more than once.
alter table promises drop constraint if exists promises_goal_metric_check;
alter table promises add constraint promises_goal_metric_check
  check (goal_metric in ('steps', 'distance_km', 'minutes', 'visit', 'calories'));
alter table promises drop constraint if exists promises_proof_check;
alter table promises add constraint promises_proof_check
  check (proof in ('gym', 'steps', 'run', 'workout', 'exercise', 'move', 'quiz', 'photo', 'friend'));
