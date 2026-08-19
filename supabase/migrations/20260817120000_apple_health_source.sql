-- Apple Health sync: new actuals source + provider-scoped external id.
-- source_id is the provider's stable workout id (HealthKit UUID); the partial
-- unique index makes every sync pass idempotent — including standalone rows
-- (workout_id null), which have no workout to dedup on. Keying by source too
-- means future providers (garmin, coros) can never collide on an id.
-- NOTE: the new enum value is added but NOT used in this migration (Postgres
-- forbids using a value added in the same transaction).

alter type actual_source add value if not exists 'apple_health';

alter table workout_actuals add column if not exists source_id text;

create unique index if not exists workout_actuals_source_dedup
  on workout_actuals (athlete_id, source, source_id)
  where source_id is not null;
