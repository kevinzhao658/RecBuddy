-- Avatars stay public (profile photos are shown by URL), but the bucket no
-- longer accepts any file of any size, and anonymous callers can no longer list
-- it to collect user ids.
--
-- * 5 MB cap and raster image types only. Both apps already cap uploads at
--   5 MB. SVG is excluded because it can carry script.
-- * Public object URLs (/object/public/avatars/...) don't consult RLS, so
--   dropping the read policy keeps every avatar visible while stopping
--   storage.objects listings. Owners still read their own folder through
--   avatars_write_own, which upsert needs.
update storage.buckets
set file_size_limit = 5242880,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'image/gif']
where id = 'avatars';

drop policy if exists "avatars_read" on storage.objects;
