-- =========================================================
-- Campus Tag
-- Core database schema
-- =========================================================


-- ---------------------------------------------------------
-- Private schema
-- Internal database functions will be placed here.
-- ---------------------------------------------------------

create schema if not exists private;


-- ---------------------------------------------------------
-- 1. app_users
-- Application-specific user information.
-- The primary key is the same UUID as Supabase Auth users.
-- ---------------------------------------------------------

create table public.app_users (
  id uuid primary key
    references auth.users(id)
    on delete cascade,

  student_number text unique,

  role text not null default 'viewer',
  account_status text not null default 'active',
  account_type text not null default 'student',

  current_suspension_reason text,
  suspended_at timestamptz,
  suspended_by_user_id uuid
    references public.app_users(id)
    on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);


-- ---------------------------------------------------------
-- 2. profiles
-- One profile per Campus Tag user.
-- ---------------------------------------------------------

create table public.profiles (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null unique
    references public.app_users(id)
    on delete cascade,

  display_name text,
  student_type text,
  cohort_number integer,
  exchange_grade_level text,
  student_type_other_text text,

  birth_date date,
  bio text,

  is_public boolean not null default false,
  is_forced_private boolean not null default false,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);


-- ---------------------------------------------------------
-- 3. languages
-- Shared language master.
-- ---------------------------------------------------------

create table public.languages (
  id uuid primary key default gen_random_uuid(),

  code text not null unique,
  name_en text not null,
  name_ja text not null,

  is_active boolean not null default true,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);


-- ---------------------------------------------------------
-- 4. profile_languages
-- Languages associated with each profile and their purpose.
-- ---------------------------------------------------------

create table public.profile_languages (
  id uuid primary key default gen_random_uuid(),

  profile_id uuid not null
    references public.profiles(id)
    on delete cascade,

  language_id uuid not null
    references public.languages(id)
    on delete restrict,

  is_native boolean not null default false,
  can_speak boolean not null default false,
  is_learning boolean not null default false,
  wants_to_interact boolean not null default false,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (profile_id, language_id)
);


-- ---------------------------------------------------------
-- 5. profile_tags
-- Tags used for profile discovery and semantic search.
-- ---------------------------------------------------------

create table public.profile_tags (
  id uuid primary key default gen_random_uuid(),

  profile_id uuid not null
    references public.profiles(id)
    on delete cascade,

  tag_text text not null,

  source text not null default 'user_added',

  review_status text not null default 'clear',

  safety_screening_status text not null default 'not_checked',
  safety_reason_category text,
  safety_reason_summary text,
  safety_checked_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);


-- =========================================================
-- updated_at automation
-- =========================================================

create or replace function private.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;


create trigger set_app_users_updated_at
before update on public.app_users
for each row
execute function private.set_updated_at();


create trigger set_profiles_updated_at
before update on public.profiles
for each row
execute function private.set_updated_at();


create trigger set_languages_updated_at
before update on public.languages
for each row
execute function private.set_updated_at();


create trigger set_profile_languages_updated_at
before update on public.profile_languages
for each row
execute function private.set_updated_at();


create trigger set_profile_tags_updated_at
before update on public.profile_tags
for each row
execute function private.set_updated_at();