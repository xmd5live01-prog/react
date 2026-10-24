create table if not exists public.cms_admins (
  email text primary key
    check (email = lower(btrim(email)) and position('@' in email) > 1),
  created_at timestamptz not null default now()
);

insert into public.cms_admins (email)
values ('xmd5live01@gmail.com')
on conflict (email) do nothing;

create or replace function public.cms_is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.cms_admins as admins
    where admins.email = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

revoke all on function public.cms_is_admin() from public, anon;
grant execute on function public.cms_is_admin() to authenticated;

create table if not exists public.cms_content_drafts (
  singleton_id boolean primary key default true check (singleton_id),
  content jsonb not null check (jsonb_typeof(content) = 'object'),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);

create table if not exists public.cms_public_content (
  singleton_id boolean primary key default true check (singleton_id),
  content jsonb not null check (jsonb_typeof(content) = 'object'),
  version integer not null check (version > 0),
  published_at timestamptz not null default now()
);

create table if not exists public.cms_content_revisions (
  id bigint generated always as identity primary key,
  version integer not null unique check (version > 0),
  content jsonb not null check (jsonb_typeof(content) = 'object'),
  published_by uuid references auth.users (id) on delete set null,
  published_at timestamptz not null default now()
);

alter table public.cms_admins enable row level security;
alter table public.cms_content_drafts enable row level security;
alter table public.cms_public_content enable row level security;
alter table public.cms_content_revisions enable row level security;

revoke all on table public.cms_admins from public, anon, authenticated;
revoke all on table public.cms_content_drafts from public, anon, authenticated;
revoke all on table public.cms_public_content from public, anon, authenticated;
revoke all on table public.cms_content_revisions from public, anon, authenticated;

grant select, insert, update on table public.cms_content_drafts to authenticated;
grant select on table public.cms_public_content to anon, authenticated;
grant select on table public.cms_content_revisions to authenticated;
grant usage, select on sequence public.cms_content_revisions_id_seq to authenticated;

create policy "CMS admins manage drafts"
  on public.cms_content_drafts
  for all
  to authenticated
  using (public.cms_is_admin())
  with check (public.cms_is_admin());

create policy "Anyone can read published site content"
  on public.cms_public_content
  for select
  to anon, authenticated
  using (true);

create policy "CMS admins read publication history"
  on public.cms_content_revisions
  for select
  to authenticated
  using (public.cms_is_admin());

create or replace function public.cms_publish_draft()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_content jsonb;
  v_version integer;
begin
  if not public.cms_is_admin() then
    raise exception 'CMS administrator access required' using errcode = '42501';
  end if;

  select drafts.content
    into v_content
    from public.cms_content_drafts as drafts
    where drafts.singleton_id = true
    for update;

  if v_content is null then
    raise exception 'Save a draft before publishing';
  end if;

  if jsonb_typeof(v_content -> 'heroSlides') is distinct from 'array'
     or jsonb_typeof(v_content -> 'announcements') is distinct from 'array'
     or jsonb_typeof(v_content -> 'services') is distinct from 'array'
     or jsonb_typeof(v_content -> 'paymentMethods') is distinct from 'array'
     or jsonb_typeof(v_content -> 'steps') is distinct from 'array'
     or not exists (
       select 1
       from jsonb_array_elements(v_content -> 'heroSlides') as slides(item)
       where slides.item ->> 'active' = 'true'
     ) then
    raise exception 'Content is incomplete or has no active hero slides';
  end if;

  select coalesce(max(revisions.version), 0) + 1
    into v_version
    from public.cms_content_revisions as revisions;

  insert into public.cms_content_revisions (version, content, published_by)
  values (v_version, v_content, auth.uid());

  insert into public.cms_public_content (singleton_id, content, version, published_at)
  values (true, v_content, v_version, now())
  on conflict (singleton_id) do update
    set content = excluded.content,
        version = excluded.version,
        published_at = excluded.published_at;

  return v_version;
end;
$$;

revoke all on function public.cms_publish_draft() from public, anon;
grant execute on function public.cms_publish_draft() to authenticated;

create or replace function public.cms_restore_revision(p_revision_id bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_content jsonb;
begin
  if not public.cms_is_admin() then
    raise exception 'CMS administrator access required' using errcode = '42501';
  end if;

  select revisions.content
    into v_content
    from public.cms_content_revisions as revisions
    where revisions.id = p_revision_id;

  if v_content is null then
    raise exception 'Publication revision not found';
  end if;

  insert into public.cms_content_drafts (singleton_id, content, updated_at, updated_by)
  values (true, v_content, now(), auth.uid())
  on conflict (singleton_id) do update
    set content = excluded.content,
        updated_at = excluded.updated_at,
        updated_by = excluded.updated_by;
end;
$$;

revoke all on function public.cms_restore_revision(bigint) from public, anon;
grant execute on function public.cms_restore_revision(bigint) to authenticated;
