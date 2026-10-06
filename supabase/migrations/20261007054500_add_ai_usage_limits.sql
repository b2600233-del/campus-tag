-- =========================================================
-- Campus Tag
-- Atomic per-user AI usage limits (Asia/Tokyo day boundary)
-- =========================================================

create or replace function public.begin_ai_request(p_feature text)
returns table (
  allowed boolean,
  denial_reason text,
  retry_after_seconds integer,
  remaining integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_today date := (now() at time zone 'Asia/Tokyo')::date;
  v_now timestamptz := now();
  v_count integer;
  v_limit integer;
  v_cooldown_seconds integer;
  v_last_request_at timestamptz;
  v_retry_after integer;
begin
  if v_user_id is null then
    raise exception 'UNAUTHENTICATED' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.app_users au
    where au.id = v_user_id
      and au.account_status = 'active'
  ) then
    raise exception 'ACTIVE_ACCOUNT_REQUIRED' using errcode = '42501';
  end if;

  if p_feature not in ('search', 'tag_generation', 'safety_screening') then
    raise exception 'INVALID_AI_FEATURE' using errcode = '22023';
  end if;

  insert into public.ai_usage_state (user_id, usage_date)
  values (v_user_id, v_today)
  on conflict (user_id) do nothing;

  perform 1
  from public.ai_usage_state aus
  where aus.user_id = v_user_id
  for update;

  update public.ai_usage_state
  set
    usage_date = v_today,
    search_successful_count = 0,
    search_last_request_at = null,
    tag_generation_successful_count = 0,
    tag_generation_last_request_at = null,
    safety_screening_successful_count = 0,
    safety_screening_last_request_at = null
  where user_id = v_user_id
    and usage_date <> v_today;

  select
    case p_feature
      when 'search' then aus.search_successful_count
      when 'tag_generation' then aus.tag_generation_successful_count
      else aus.safety_screening_successful_count
    end,
    case p_feature
      when 'search' then aus.search_last_request_at
      when 'tag_generation' then aus.tag_generation_last_request_at
      else aus.safety_screening_last_request_at
    end
  into v_count, v_last_request_at
  from public.ai_usage_state aus
  where aus.user_id = v_user_id;

  case p_feature
    when 'search' then
      v_limit := 50;
      v_cooldown_seconds := 3;
    when 'tag_generation' then
      v_limit := 10;
      v_cooldown_seconds := 10;
    else
      -- Safety Screening is required for publication and therefore
      -- tracked without a daily cap or cooldown.
      v_limit := null;
      v_cooldown_seconds := 0;
  end case;

  if v_limit is not null and v_count >= v_limit then
    return query select false, 'daily_limit', 0, 0;
    return;
  end if;

  if
    v_cooldown_seconds > 0
    and v_last_request_at is not null
    and v_last_request_at + make_interval(secs => v_cooldown_seconds) > v_now
  then
    v_retry_after := greatest(
      1,
      ceil(extract(epoch from (
        v_last_request_at
        + make_interval(secs => v_cooldown_seconds)
        - v_now
      )))::integer
    );

    return query select
      false,
      'cooldown',
      v_retry_after,
      case when v_limit is null then null else greatest(v_limit - v_count, 0) end;
    return;
  end if;

  update public.ai_usage_state
  set
    search_last_request_at = case
      when p_feature = 'search' then v_now
      else search_last_request_at
    end,
    tag_generation_last_request_at = case
      when p_feature = 'tag_generation' then v_now
      else tag_generation_last_request_at
    end,
    safety_screening_last_request_at = case
      when p_feature = 'safety_screening' then v_now
      else safety_screening_last_request_at
    end
  where user_id = v_user_id;

  return query select
    true,
    null::text,
    0,
    case when v_limit is null then null else greatest(v_limit - v_count, 0) end;
end;
$$;

create or replace function public.record_ai_success(p_feature text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'UNAUTHENTICATED' using errcode = '42501';
  end if;

  if p_feature not in ('search', 'tag_generation', 'safety_screening') then
    raise exception 'INVALID_AI_FEATURE' using errcode = '22023';
  end if;

  update public.ai_usage_state
  set
    search_successful_count = search_successful_count + case
      when p_feature = 'search' then 1 else 0
    end,
    tag_generation_successful_count = tag_generation_successful_count + case
      when p_feature = 'tag_generation' then 1 else 0
    end,
    safety_screening_successful_count = safety_screening_successful_count + case
      when p_feature = 'safety_screening' then 1 else 0
    end
  where user_id = v_user_id
    and usage_date = (now() at time zone 'Asia/Tokyo')::date;

  if not found then
    raise exception 'AI_REQUEST_NOT_STARTED' using errcode = '55000';
  end if;
end;
$$;

revoke execute on function public.begin_ai_request(text) from public;
revoke execute on function public.begin_ai_request(text) from anon;
grant execute on function public.begin_ai_request(text) to authenticated;

revoke execute on function public.record_ai_success(text) from public;
revoke execute on function public.record_ai_success(text) from anon;
grant execute on function public.record_ai_success(text) to authenticated;
