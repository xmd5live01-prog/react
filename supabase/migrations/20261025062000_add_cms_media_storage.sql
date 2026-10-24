insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'cms-media',
  'cms-media',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy "Public can read CMS media"
  on storage.objects
  for select
  to anon, authenticated
  using (bucket_id = 'cms-media');

create policy "CMS admins can upload media"
  on storage.objects
  for insert
  to authenticated
  with check (bucket_id = 'cms-media' and public.cms_is_admin());
