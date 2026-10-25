-- Chat videos, part 1: the message kind. Its own migration because Postgres
-- can't use a new enum value in the transaction that adds it.
alter type message_kind add value if not exists 'video';
