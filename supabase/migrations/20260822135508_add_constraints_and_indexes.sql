-- =========================================================
-- Campus Tag
-- Constraints, indexes, and integrity rules
-- =========================================================


-- =========================================================
-- 1. app_users
-- =========================================================

alter table public.app_users
  add constraint app_users_role_check
    check (
      role in ('viewer', 'editor', 'admin')
    ),

  add constraint app_users_account_status_check
    check (
      account_status in ('active', 'suspended')
    ),

  add constraint app_users_account_type_check
    check (
      account_type in ('student', 'demo')
    ),

  add constraint app_users_student_number_not_blank_check
    check (
      student_number is null
      or length(btrim(student_number)) > 0
    ),

  add constraint app_users_suspension_state_check
    check (
      (
        account_status = 'active'
        and current_suspension_reason is null
        and suspended_at is null
        and suspended_by_user_id is null
      )
      or
      (
        account_status = 'suspended'
        and current_suspension_reason is not null
        and length(btrim(current_suspension_reason)) > 0
        and suspended_at is not null
      )
    );


-- =========================================================
-- 2. profiles
-- Draft profiles may keep student_type NULL.
-- Once set, only the four MVP student types are allowed.
-- =========================================================

alter table public.profiles
  add constraint profiles_display_name_not_blank_check
    check (
      display_name is null
      or length(btrim(display_name)) > 0
    ),

  add constraint profiles_student_type_check
    check (
      student_type is null
      or student_type in (
        'regular',
        'exchange',
        'graduate',
        'other'
      )
    ),

  add constraint profiles_cohort_number_positive_check
    check (
      cohort_number is null
      or cohort_number > 0
    ),

  add constraint profiles_bio_not_blank_check
    check (
      bio is null
      or length(btrim(bio)) > 0
    ),

  add constraint profiles_student_type_other_text_not_blank_check
    check (
      student_type_other_text is null
      or length(btrim(student_type_other_text)) > 0
    );


-- =========================================================
-- 3. languages
-- =========================================================

alter table public.languages
  add constraint languages_code_not_blank_check
    check (
      length(btrim(code)) > 0
    ),

  add constraint languages_name_en_not_blank_check
    check (
      length(btrim(name_en)) > 0
    ),

  add constraint languages_name_ja_not_blank_check
    check (
      length(btrim(name_ja)) > 0
    );


-- =========================================================
-- 4. profile_languages
--
-- At least one relationship with the language must exist.
-- =========================================================

alter table public.profile_languages
  add constraint profile_languages_at_least_one_flag_check
    check (
      is_native
      or can_speak
      or is_learning
      or wants_to_interact
    );


-- =========================================================
-- 5. profile_tags
-- =========================================================

alter table public.profile_tags
  add constraint profile_tags_tag_text_not_blank_check
    check (
      length(btrim(tag_text)) > 0
    ),

  add constraint profile_tags_source_check
    check (
      source in (
        'ai_generated',
        'user_added'
      )
    ),

  add constraint profile_tags_review_status_check
    check (
      review_status in (
        'clear',
        'needs_editor_review',
        'needs_admin_review'
      )
    ),

  add constraint profile_tags_safety_screening_status_check
    check (
      safety_screening_status in (
        'not_checked',
        'passed',
        'flagged',
        'error'
      )
    ),

  add constraint profile_tags_safety_reason_category_check
    check (
      safety_reason_category is null
      or safety_reason_category in (
        'personal_information',
        'inappropriate_content',
        'harassment_or_attack',
        'unsafe_or_illegal',
        'other'
      )
    ),

  add constraint profile_tags_flagged_reason_check
    check (
      safety_screening_status <> 'flagged'
      or (
        safety_reason_category is not null
        and safety_reason_summary is not null
        and length(btrim(safety_reason_summary)) > 0
      )
    );


-- =========================================================
-- 6. review_requests
-- =========================================================

alter table public.review_requests
  add constraint review_requests_reason_category_check
    check (
      reason_category in (
        'personal_information',
        'inappropriate_content',
        'harassment_or_attack',
        'unsafe_or_illegal',
        'other'
      )
    ),

  add constraint review_requests_status_check
    check (
      status in (
        'pending_admin_review',
        'waiting_for_user',
        'resolved',
        'dismissed'
      )
    ),

  add constraint review_requests_target_tag_source_snapshot_check
    check (
      target_tag_source_snapshot is null
      or target_tag_source_snapshot in (
        'ai_generated',
        'user_added'
      )
    ),

  add constraint review_requests_closed_state_check
    check (
      (
        status in (
          'pending_admin_review',
          'waiting_for_user'
        )
        and closed_at is null
      )
      or
      (
        status in (
          'resolved',
          'dismissed'
        )
        and closed_at is not null
      )
    );


-- =========================================================
-- 7. ai_usage_state
--
-- Usage counters can never be negative.
-- =========================================================

alter table public.ai_usage_state
  add constraint ai_usage_state_search_count_check
    check (
      search_successful_count >= 0
    ),

  add constraint ai_usage_state_tag_generation_count_check
    check (
      tag_generation_successful_count >= 0
    ),

  add constraint ai_usage_state_safety_screening_count_check
    check (
      safety_screening_successful_count >= 0
    );


-- =========================================================
-- 8. Tag normalization / duplicate prevention
--
-- Duplicate definition:
-- - case-insensitive
-- - trim leading / trailing whitespace
-- - collapse repeated whitespace
--
-- Width normalization is intentionally not performed.
-- =========================================================

create unique index profile_tags_profile_normalized_tag_unique
on public.profile_tags (
  profile_id,
  lower(
    regexp_replace(
      btrim(tag_text),
      '[[:space:]]+',
      ' ',
      'g'
    )
  )
);


-- =========================================================
-- 9. Maximum 12 tags per profile
--
-- Lock the owning profile row first so concurrent requests
-- cannot both bypass the tag limit.
-- =========================================================

create or replace function private.enforce_profile_tag_limit()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  existing_tag_count integer;
begin
  perform 1
  from public.profiles
  where id = new.profile_id
  for update;

  select count(*)
  into existing_tag_count
  from public.profile_tags
  where profile_id = new.profile_id
    and id <> new.id;

  if existing_tag_count >= 12 then
    raise exception
      'A profile cannot have more than 12 tags.';
  end if;

  return new;
end;
$$;


create trigger enforce_profile_tag_limit
before insert or update of profile_id
on public.profile_tags
for each row
execute function private.enforce_profile_tag_limit();


-- =========================================================
-- 10. Prevent deactivation of referenced languages
--
-- MVP:
-- true -> false is rejected whenever profile_languages
-- still references the language.
-- =========================================================

create or replace function private.prevent_referenced_language_deactivation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.is_active = true
     and new.is_active = false
  then
    if exists (
      select 1
      from public.profile_languages
      where language_id = old.id
    ) then
      raise exception
        'Cannot deactivate a language that is referenced by profiles.';
    end if;
  end if;

  return new;
end;
$$;


create trigger prevent_referenced_language_deactivation
before update of is_active
on public.languages
for each row
execute function private.prevent_referenced_language_deactivation();


-- =========================================================
-- 11. Prevent duplicate unresolved formal moderation cases
--
-- Only one unresolved formal case may exist per tag.
-- =========================================================

create unique index review_requests_one_open_case_per_tag
on public.review_requests (tag_id)
where
  tag_id is not null
  and status in (
    'pending_admin_review',
    'waiting_for_user'
  );


-- =========================================================
-- 12. Query-supporting indexes
--
-- PostgreSQL automatically indexes PK / UNIQUE constraints,
-- but not every foreign key or filtering column.
-- =========================================================

create index app_users_suspended_by_user_id_idx
  on public.app_users (suspended_by_user_id);

create index app_users_role_account_status_idx
  on public.app_users (
    role,
    account_status
  );


create index languages_is_active_idx
  on public.languages (is_active);


create index profile_languages_language_id_idx
  on public.profile_languages (language_id);


create index profile_tags_public_readiness_idx
  on public.profile_tags (
    profile_id,
    review_status,
    safety_screening_status
  );

create index profile_tags_editor_review_queue_idx
  on public.profile_tags (
    review_status,
    safety_screening_status,
    created_at
  )
  where
    review_status = 'needs_editor_review'
    and safety_screening_status = 'flagged';


create index review_requests_profile_id_idx
  on public.review_requests (profile_id);

create index review_requests_target_user_id_idx
  on public.review_requests (target_user_id);

create index review_requests_tag_id_idx
  on public.review_requests (tag_id);

create index review_requests_requested_by_idx
  on public.review_requests (requested_by);

create index review_requests_status_idx
  on public.review_requests (status);


create index ai_tag_regeneration_batches_user_id_idx
  on public.ai_tag_regeneration_batches (user_id);

create index ai_tag_regeneration_batches_profile_id_idx
  on public.ai_tag_regeneration_batches (profile_id);

create index ai_tag_regeneration_batches_expiry_idx
  on public.ai_tag_regeneration_batches (
    expires_at,
    consumed_at
  );