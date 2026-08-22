-- =========================================================
-- Campus Tag
-- Moderation and AI database schema
-- =========================================================


-- ---------------------------------------------------------
-- 1. review_requests
-- Formal moderation cases escalated from Editor to Admin.
--
-- In the MVP, normal review requests are created for tags.
-- Minimal snapshots are retained so that the moderation
-- record can survive deletion of the original tag/profile.
-- ---------------------------------------------------------

create table public.review_requests (
  id uuid primary key default gen_random_uuid(),

  profile_id uuid
    references public.profiles(id)
    on delete set null,

  target_user_id uuid
    references public.app_users(id)
    on delete set null,

  tag_id uuid
    references public.profile_tags(id)
    on delete set null,

  -- Minimal moderation snapshots.
  target_display_name_snapshot text,
  target_tag_snapshot text,
  target_tag_source_snapshot text,
  target_field text,
  problematic_content_snapshot text,

  -- Editor who escalated the case.
  -- The moderation record survives even if the account
  -- is later deleted.
  requested_by uuid
    references public.app_users(id)
    on delete set null,

  reason_category text not null,
  editor_comment text,

  status text not null default 'pending_admin_review',

  resolution_action text,
  admin_comment text,
  user_message text,

  closed_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);


-- ---------------------------------------------------------
-- 2. ai_usage_state
-- Server-controlled AI usage state for each user.
--
-- Search and tag generation are separate user-facing
-- features.
--
-- Safety Screening is tracked separately and must not be
-- blocked merely because the user has exhausted an optional
-- Search / Tag Generation quota.
-- ---------------------------------------------------------

create table public.ai_usage_state (
  user_id uuid primary key
    references public.app_users(id)
    on delete cascade,

  usage_date date not null
    default ((now() at time zone 'Asia/Tokyo')::date),

  search_successful_count integer not null default 0,
  search_last_request_at timestamptz,

  tag_generation_successful_count integer not null default 0,
  tag_generation_last_request_at timestamptz,

  safety_screening_successful_count integer not null default 0,
  safety_screening_last_request_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);


-- ---------------------------------------------------------
-- 3. ai_tag_regeneration_batches
-- Temporary server-side storage for AI-generated
-- tag-regeneration candidates.
--
-- candidate_payload will contain only the data required to
-- confirm a regeneration batch, including:
--
--   candidate_id
--   tag_text
--   source_tag_id
--   source_tag_updated_at_snapshot
--
-- The server compares source_tag_updated_at_snapshot with
-- the current profile_tags.updated_at before applying the
-- replacement. A mismatch results in CONFLICT.
-- ---------------------------------------------------------

create table public.ai_tag_regeneration_batches (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null
    references public.app_users(id)
    on delete cascade,

  profile_id uuid not null
    references public.profiles(id)
    on delete cascade,

  candidate_payload jsonb not null,

  expires_at timestamptz not null,
  consumed_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);


-- =========================================================
-- updated_at automation
-- Reuse private.set_updated_at() created by the
-- core-schema migration.
-- =========================================================

create trigger set_review_requests_updated_at
before update on public.review_requests
for each row
execute function private.set_updated_at();


create trigger set_ai_usage_state_updated_at
before update on public.ai_usage_state
for each row
execute function private.set_updated_at();


create trigger set_ai_tag_regeneration_batches_updated_at
before update on public.ai_tag_regeneration_batches
for each row
execute function private.set_updated_at();