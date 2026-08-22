-- =========================================================
-- Campus Tag
-- Safe public profile access layer
-- =========================================================


-- =========================================================
-- 1. Internal safe public-profile source
--
-- Raw tables remain protected by RLS.
--
-- This SECURITY DEFINER function is the single controlled
-- path that may read across users' raw profile tables.
--
-- It returns ONLY explicitly approved public fields and
-- ONLY effectively-public profiles.
-- =========================================================

create or replace function private.public_profile_rows()
returns table (
  profile_id uuid,
  display_name text,
  student_type text,
  cohort_number integer,
  exchange_grade_level text,
  student_type_other_text text,
  age integer,
  bio text,
  languages jsonb,
  tags text[]
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    p.id as profile_id,

    p.display_name,

    p.student_type,

    case
      when p.student_type = 'regular'
        then p.cohort_number
      else null
    end as cohort_number,

    case
      when p.student_type = 'exchange'
        then p.exchange_grade_level
      else null
    end as exchange_grade_level,

    case
      when p.student_type = 'other'
        then p.student_type_other_text
      else null
    end as student_type_other_text,

    extract(
      year from age(
        (now() at time zone 'Asia/Tokyo')::date,
        p.birth_date
      )
    )::integer as age,

    p.bio,

    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'code', l.code,
            'name_en', l.name_en,
            'name_ja', l.name_ja,
            'is_native', pl.is_native,
            'can_speak', pl.can_speak,
            'is_learning', pl.is_learning,
            'wants_to_interact', pl.wants_to_interact
          )
          order by l.code
        )
        from public.profile_languages pl
        join public.languages l
          on l.id = pl.language_id
        where pl.profile_id = p.id
          and l.is_active = true
      ),
      '[]'::jsonb
    ) as languages,

    coalesce(
      (
        select array_agg(
          pt.tag_text
          order by lower(pt.tag_text), pt.id
        )
        from public.profile_tags pt
        where pt.profile_id = p.id
          and pt.review_status = 'clear'
          and pt.safety_screening_status in (
            'passed',
            'flagged'
          )
      ),
      array[]::text[]
    ) as tags

  from public.profiles p

  join public.app_users au
    on au.id = p.user_id

  where

    -- The caller must be an active Campus Tag account.
    private.has_min_role('viewer')

    -- Owner's publication intent.
    and p.is_public = true

    -- Moderation/system-level forced privacy.
    and p.is_forced_private = false

    -- Account itself must be active.
    and au.account_status = 'active'

    -- -----------------------------------------------------
    -- Required basic profile information
    -- -----------------------------------------------------

    and p.display_name is not null
    and length(btrim(p.display_name)) > 0

    and p.birth_date is not null

    and p.bio is not null
    and length(btrim(p.bio)) > 0

    and p.student_type in (
      'regular',
      'exchange',
      'graduate',
      'other'
    )

    -- -----------------------------------------------------
    -- Student-type-specific publication requirements
    -- -----------------------------------------------------

    and (
      (
        p.student_type = 'regular'
        and p.cohort_number is not null
      )

      or

      (
        p.student_type = 'exchange'
        and p.exchange_grade_level is not null
        and length(btrim(p.exchange_grade_level)) > 0
      )

      or

      (
        p.student_type = 'graduate'
      )

      or

      (
        p.student_type = 'other'
        and p.student_type_other_text is not null
        and length(btrim(p.student_type_other_text)) > 0
      )
    )

    -- -----------------------------------------------------
    -- At least one active native language is required
    -- -----------------------------------------------------

    and exists (
      select 1
      from public.profile_languages native_pl
      join public.languages native_l
        on native_l.id = native_pl.language_id
      where native_pl.profile_id = p.id
        and native_pl.is_native = true
        and native_l.is_active = true
    )

    -- -----------------------------------------------------
    -- At least one public-ready tag is required
    --
    -- passed + clear:
    --   AI screening found no issue.
    --
    -- flagged + clear:
    --   AI flagged it, but Editor reviewed and cleared it.
    --
    -- not_checked / error:
    --   never public-ready.
    -- -----------------------------------------------------

    and exists (
      select 1
      from public.profile_tags ready_tag
      where ready_tag.profile_id = p.id
        and ready_tag.review_status = 'clear'
        and ready_tag.safety_screening_status in (
          'passed',
          'flagged'
        )
    );
$$;


-- =========================================================
-- 2. Function privileges
-- =========================================================

revoke execute
  on function private.public_profile_rows()
  from public;

revoke execute
  on function private.public_profile_rows()
  from anon;

grant execute
  on function private.public_profile_rows()
  to authenticated;


-- =========================================================
-- 3. Safe public_profiles view
--
-- The view itself contains no:
--
-- - user_id
-- - email
-- - student_number
-- - raw birth_date
-- - is_forced_private
-- - moderation reason
-- - Safety Screening reason
-- - internal timestamps
-- =========================================================

create view public.public_profiles
with (security_invoker = true)
as
select
  profile_id,
  display_name,
  student_type,
  cohort_number,
  exchange_grade_level,
  student_type_other_text,
  age,
  bio,
  languages,
  tags
from private.public_profile_rows();


-- =========================================================
-- 4. View privileges
--
-- Campus Tag is authenticated-user-only.
-- No anonymous public-profile browsing.
-- =========================================================

revoke all privileges
  on table public.public_profiles
  from public;

revoke all privileges
  on table public.public_profiles
  from anon;

revoke all privileges
  on table public.public_profiles
  from authenticated;

grant select
  on table public.public_profiles
  to authenticated;


-- =========================================================
-- 5. Limited safe RPC
--
-- Retrieves safe public-profile rows only.
--
-- It can optionally receive a list of profile IDs.
-- This will later be useful when the Search layer has
-- selected candidate IDs and needs safe display data.
--
-- Maximum 10 profiles are returned.
-- =========================================================

create or replace function public.get_public_profiles(
  p_profile_ids uuid[] default null,
  p_limit integer default 10
)
returns table (
  profile_id uuid,
  display_name text,
  student_type text,
  cohort_number integer,
  exchange_grade_level text,
  student_type_other_text text,
  age integer,
  bio text,
  languages jsonb,
  tags text[]
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    pp.profile_id,
    pp.display_name,
    pp.student_type,
    pp.cohort_number,
    pp.exchange_grade_level,
    pp.student_type_other_text,
    pp.age,
    pp.bio,
    pp.languages,
    pp.tags
  from public.public_profiles pp

  where
    p_profile_ids is null
    or pp.profile_id = any(p_profile_ids)

  order by
    case
      when p_profile_ids is null
        then null
      else array_position(
        p_profile_ids,
        pp.profile_id
      )
    end nulls last,

    pp.profile_id

  limit greatest(
    1,
    least(
      coalesce(p_limit, 10),
      10
    )
  );
$$;


-- =========================================================
-- 6. RPC privileges
--
-- PostgreSQL functions are executable by PUBLIC by default,
-- so explicitly remove that default access.
-- =========================================================

revoke execute
  on function public.get_public_profiles(uuid[], integer)
  from public;

revoke execute
  on function public.get_public_profiles(uuid[], integer)
  from anon;

grant execute
  on function public.get_public_profiles(uuid[], integer)
  to authenticated;