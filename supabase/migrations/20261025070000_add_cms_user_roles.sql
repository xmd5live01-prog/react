create table public.cms_users (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email text not null unique,
  role text not null check (role in ('admin', 'editor')),
  permissions text[] not null default '{}',
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  constraint cms_users_allowed_permissions check (
    permissions <@ array[
      'edit_sections',
      'edit_layout',
      'edit_site_settings',
      'save_draft',
      'publish_content',
      'restore_revisions'
    ]::text[]
  )
);

insert into public.cms_users (user_id, email, role)
select users.id, lower(users.email), 'admin'
from auth.users as users
join public.cms_admins as admins
  on admins.email = lower(users.email)
where users.email is not null
on conflict (user_id) do update
set email = excluded.email,
    role = 'admin',
    permissions = '{}';

create or replace function public.cms_bootstrap_allowlisted_admin()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.email is not null and exists (
    select 1
    from public.cms_admins as admins
    where admins.email = lower(new.email)
  ) then
    insert into public.cms_users (user_id, email, role)
    values (new.id, lower(new.email), 'admin')
    on conflict (user_id) do update
      set email = excluded.email,
          role = 'admin',
          permissions = '{}';
  end if;
  return new;
end;
$$;

revoke all on function public.cms_bootstrap_allowlisted_admin() from public, anon, authenticated;
drop trigger if exists cms_bootstrap_allowlisted_admin on auth.users;
create trigger cms_bootstrap_allowlisted_admin
  after insert or update of email on auth.users
  for each row
  execute function public.cms_bootstrap_allowlisted_admin();

alter table public.cms_users enable row level security;
revoke all on table public.cms_users from public, anon, authenticated;
grant select on table public.cms_users to authenticated;

create or replace function public.cms_is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.cms_users as users
    where users.user_id = auth.uid()
      and users.role = 'admin'
  );
$$;

create or replace function public.cms_can_access()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.cms_users as users
    where users.user_id = auth.uid()
  );
$$;

create or replace function public.cms_has_permission(p_permission text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.cms_is_admin() or exists (
    select 1
    from public.cms_users as users
    where users.user_id = auth.uid()
      and users.permissions @> array[p_permission]
  );
$$;

create or replace function public.cms_get_access()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'role', users.role,
    'permissions', to_jsonb(users.permissions)
  )
  from public.cms_users as users
  where users.user_id = auth.uid();
$$;

revoke all on function public.cms_is_admin() from public, anon;
revoke all on function public.cms_can_access() from public, anon;
revoke all on function public.cms_has_permission(text) from public, anon;
revoke all on function public.cms_get_access() from public, anon;
grant execute on function public.cms_is_admin() to authenticated;
grant execute on function public.cms_can_access() to authenticated;
grant execute on function public.cms_has_permission(text) to authenticated;
grant execute on function public.cms_get_access() to authenticated;

create policy "CMS admins read user assignments"
  on public.cms_users
  for select
  to authenticated
  using (public.cms_is_admin() or user_id = auth.uid());

drop policy if exists "CMS admins manage drafts" on public.cms_content_drafts;
drop policy if exists "CMS members read drafts" on public.cms_content_drafts;
create policy "CMS members read drafts"
  on public.cms_content_drafts
  for select
  to authenticated
  using (public.cms_can_access());

revoke all on table public.cms_content_drafts from public, anon, authenticated;
grant select on table public.cms_content_drafts to authenticated;

drop policy if exists "CMS admins read publication history" on public.cms_content_revisions;
create policy "CMS members with revision access read publication history"
  on public.cms_content_revisions
  for select
  to authenticated
  using (public.cms_has_permission('restore_revisions'));

create or replace function public.cms_check_content_permissions(
  p_old_content jsonb,
  p_new_content jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_key text;
  v_old_content jsonb := coalesce(p_old_content, '{}'::jsonb);
begin
  if public.cms_is_admin() then
    return;
  end if;

  for v_key in
    select keys.key
    from (
      select jsonb_object_keys(v_old_content) as key
      union
      select jsonb_object_keys(p_new_content) as key
    ) as keys
  loop
    if v_old_content -> v_key is not distinct from p_new_content -> v_key then
      continue;
    end if;

    if v_key in ('heroSlides', 'announcements', 'services', 'paymentMethods', 'steps') then
      if not public.cms_has_permission('edit_sections') then
        raise exception 'Permission required to edit page sections' using errcode = '42501';
      end if;
    elsif v_key in ('landingTemplate', 'layoutOrder', 'hiddenSections', 'customSections') then
      if not public.cms_has_permission('edit_layout') then
        raise exception 'Permission required to edit page layout' using errcode = '42501';
      end if;
    elsif v_key in (
      'siteTitle', 'siteLogoImage', 'heroBackgroundImage', 'primaryColor',
      'accentColor', 'pageBackgroundColor', 'surfaceColor', 'textColor',
      'mutedTextColor', 'heroKicker', 'announcementsTitle', 'servicesHeading',
      'servicesSubheading', 'paymentHeading', 'paymentDescription',
      'stepsHeading', 'footerTagline'
    ) then
      if not public.cms_has_permission('edit_site_settings') then
        raise exception 'Permission required to edit site settings' using errcode = '42501';
      end if;
    else
      raise exception 'Unsupported CMS content field: %', v_key using errcode = '42501';
    end if;
  end loop;
end;
$$;

create or replace function public.cms_save_draft(p_content jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old_content jsonb;
begin
  if not public.cms_can_access() then
    raise exception 'CMS access required' using errcode = '42501';
  end if;
  if not (
    public.cms_has_permission('save_draft')
    or public.cms_has_permission('publish_content')
  ) then
    raise exception 'Draft saving permission required' using errcode = '42501';
  end if;
  if jsonb_typeof(p_content) is distinct from 'object' then
    raise exception 'CMS content must be an object';
  end if;

  select drafts.content
    into v_old_content
    from public.cms_content_drafts as drafts
    where drafts.singleton_id = true
    for update;

  if v_old_content is null then
    select published.content
      into v_old_content
      from public.cms_public_content as published
      where published.singleton_id = true;
  end if;

  if v_old_content is null and not public.cms_is_admin()
     and not (
       public.cms_has_permission('edit_sections')
       and public.cms_has_permission('edit_layout')
       and public.cms_has_permission('edit_site_settings')
     ) then
    raise exception 'Initial CMS setup requires all content editing permissions' using errcode = '42501';
  end if;

  perform public.cms_check_content_permissions(v_old_content, p_content);

  insert into public.cms_content_drafts (
    singleton_id, content, updated_at, updated_by
  )
  values (true, p_content, now(), auth.uid())
  on conflict (singleton_id) do update
    set content = excluded.content,
        updated_at = excluded.updated_at,
        updated_by = excluded.updated_by;
end;
$$;

revoke all on function public.cms_check_content_permissions(jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.cms_save_draft(jsonb) from public, anon;
grant execute on function public.cms_save_draft(jsonb) to authenticated;

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
  if not public.cms_has_permission('publish_content') then
    raise exception 'Content publishing permission required' using errcode = '42501';
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

create or replace function public.cms_restore_revision(p_revision_id bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_content jsonb;
begin
  if not public.cms_has_permission('restore_revisions') then
    raise exception 'Revision restore permission required' using errcode = '42501';
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

revoke all on function public.cms_publish_draft() from public, anon;
grant execute on function public.cms_publish_draft() to authenticated;
revoke all on function public.cms_restore_revision(bigint) from public, anon;
grant execute on function public.cms_restore_revision(bigint) to authenticated;

drop policy if exists "CMS admins can upload media" on storage.objects;
create policy "CMS members with settings permission can upload media"
  on storage.objects
  for insert
  to authenticated
  with check (bucket_id = 'cms-media' and public.cms_has_permission('edit_site_settings'));
