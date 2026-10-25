alter table public.cms_users
  add column active boolean not null default true;

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
      and users.active
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
      and users.active
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
      and users.active
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
  where users.user_id = auth.uid()
    and users.active;
$$;

create or replace function public.cms_set_user_active(
  p_actor_id uuid,
  p_user_id uuid,
  p_active boolean
)
returns table (user_id uuid, email text, role text, active boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_target public.cms_users%rowtype;
begin
  lock table public.cms_users in exclusive mode;

  if not exists (
    select 1
    from public.cms_users as admins
    where admins.user_id = p_actor_id
      and admins.role = 'admin'
      and admins.active
  ) then
    raise exception 'Active Administrator access is required' using errcode = '42501';
  end if;

  if p_actor_id = p_user_id then
    raise exception 'You cannot deactivate your own account';
  end if;

  select users.*
    into v_target
    from public.cms_users as users
    where users.user_id = p_user_id
    for update;

  if not found then
    raise exception 'CMS user not found';
  end if;

  if not p_active and v_target.role = 'admin' and v_target.active then
    if (
      select count(*)
      from public.cms_users as admins
      where admins.role = 'admin'
        and admins.active
    ) <= 1 then
      raise exception 'The last active Administrator cannot be deactivated';
    end if;
  end if;

  return query
  update public.cms_users as users
     set active = p_active
   where users.user_id = p_user_id
  returning users.user_id, users.email, users.role, users.active;
end;
$$;

revoke all on function public.cms_set_user_active(uuid, uuid, boolean) from public, anon, authenticated;
grant execute on function public.cms_set_user_active(uuid, uuid, boolean) to service_role;
