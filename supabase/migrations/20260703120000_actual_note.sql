-- Free-form athlete comment on a logged run ("how did it go?").
alter table workout_actuals add column if not exists note text;
