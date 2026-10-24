create schema if not exists wbs_private;

revoke all on schema wbs_private from public, anon, authenticated;

create table if not exists wbs_private.bill_lookup_rate_limits (
  bucket_key text primary key check (bucket_key ~ '^[0-9a-f]{64}$'),
  window_started_at timestamptz not null,
  request_count integer not null check (request_count > 0)
);

create index if not exists bill_lookup_rate_limits_window_idx
  on wbs_private.bill_lookup_rate_limits (window_started_at);

revoke all on table wbs_private.bill_lookup_rate_limits
  from public, anon, authenticated;

create or replace function public.consume_bill_lookup_limits(
  p_ip_bucket_key text,
  p_account_bucket_key text
)
returns table (allowed boolean, retry_after_seconds integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_window interval := interval '10 minutes';
  v_ip_count integer;
  v_ip_started_at timestamptz;
  v_account_count integer;
  v_account_started_at timestamptz;
  v_retry_seconds integer;
  v_bucket_key text;
begin
  if p_ip_bucket_key !~ '^[0-9a-f]{64}$'
     or p_account_bucket_key !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid rate limit bucket key';
  end if;

  for v_bucket_key in
    select keys.bucket_key
    from unnest(array[p_ip_bucket_key, p_account_bucket_key]) as keys(bucket_key)
    order by keys.bucket_key
  loop
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(v_bucket_key, 0)
    );
  end loop;

  insert into wbs_private.bill_lookup_rate_limits as limits (
    bucket_key, window_started_at, request_count
  )
  values (p_ip_bucket_key, v_now, 1)
  on conflict (bucket_key) do update
  set window_started_at = case
        when limits.window_started_at <= v_now - v_window then v_now
        else limits.window_started_at
      end,
      request_count = case
        when limits.window_started_at <= v_now - v_window then 1
        else limits.request_count + 1
      end
  returning limits.request_count, limits.window_started_at
  into v_ip_count, v_ip_started_at;

  if v_ip_count > 30 then
    return query select false, greatest(
      1,
      ceil(extract(epoch from (v_ip_started_at + v_window - v_now)))::integer
    );
    return;
  end if;

  insert into wbs_private.bill_lookup_rate_limits as limits (
    bucket_key, window_started_at, request_count
  )
  values (p_account_bucket_key, v_now, 1)
  on conflict (bucket_key) do update
  set window_started_at = case
        when limits.window_started_at <= v_now - v_window then v_now
        else limits.window_started_at
      end,
      request_count = case
        when limits.window_started_at <= v_now - v_window then 1
        else limits.request_count + 1
      end
  returning limits.request_count, limits.window_started_at
  into v_account_count, v_account_started_at;

  if v_account_count > 5 then
    v_retry_seconds := greatest(
      1,
      ceil(extract(epoch from (v_account_started_at + v_window - v_now)))::integer
    );
    return query select false, v_retry_seconds;
    return;
  end if;

  if pg_catalog.random() < 0.01 then
    with expired as (
      select limits.bucket_key
      from wbs_private.bill_lookup_rate_limits as limits
      where limits.window_started_at < v_now - interval '1 day'
      order by limits.window_started_at
      limit 100
    )
    delete from wbs_private.bill_lookup_rate_limits as limits
    using expired
    where limits.bucket_key = expired.bucket_key;
  end if;

  return query select true, 0;
end;
$$;

revoke all on function public.consume_bill_lookup_limits(text, text)
  from public, anon, authenticated;
grant execute on function public.consume_bill_lookup_limits(text, text)
  to service_role;
