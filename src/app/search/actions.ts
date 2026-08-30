'use server'

import { parseSearchQuery } from '@/lib/gemini/search'
import {
  hasEffectiveSearchCriteria,
  matchPublicProfiles,
  type ProfileSearchResult,
  type PublicProfileLanguage,
  type SearchablePublicProfile,
} from '@/lib/search/matcher'
import { createClient } from '@/lib/supabase/server'

export type SearchProfilesResponse =
  | {
      ok: true
      results: ProfileSearchResult[]
    }
  | {
      ok: false
      error: string
    }

function isRecord(
  value: unknown
): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value)
  )
}

function parseBoolean(value: unknown) {
  return value === true
}

function parsePublicProfileLanguage(
  value: unknown
): PublicProfileLanguage | null {
  if (!isRecord(value)) {
    return null
  }

  if (
    typeof value.code !== 'string' ||
    typeof value.name_en !== 'string' ||
    typeof value.name_ja !== 'string'
  ) {
    return null
  }

  return {
    code: value.code,
    nameEn: value.name_en,
    nameJa: value.name_ja,
    isNative: parseBoolean(
      value.is_native
    ),
    canSpeak: parseBoolean(
      value.can_speak
    ),
    isLearning: parseBoolean(
      value.is_learning
    ),
    wantsToInteract: parseBoolean(
      value.wants_to_interact
    ),
  }
}

function parseLanguages(
  value: unknown
): PublicProfileLanguage[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .map(parsePublicProfileLanguage)
    .filter(
      (
        language
      ): language is PublicProfileLanguage =>
        language !== null
    )
}

function parseTags(value: unknown) {
  if (!Array.isArray(value)) {
    return []
  }

  return value.filter(
    (tag): tag is string =>
      typeof tag === 'string'
  )
}

function parseNullableString(
  value: unknown
) {
  return typeof value === 'string'
    ? value
    : null
}

function parseNullableNumber(
  value: unknown
) {
  return typeof value === 'number'
    ? value
    : null
}

function parseSearchableProfile(
  value: unknown
): SearchablePublicProfile | null {
  if (!isRecord(value)) {
    return null
  }

  if (
    typeof value.profile_id !== 'string' ||
    typeof value.display_name !==
      'string' ||
    typeof value.student_type !==
      'string' ||
    typeof value.age !== 'number' ||
    typeof value.bio !== 'string'
  ) {
    return null
  }

  return {
    profileId: value.profile_id,
    displayName: value.display_name,
    studentType: value.student_type,
    cohortNumber: parseNullableNumber(
      value.cohort_number
    ),
    exchangeGradeLevel:
      parseNullableString(
        value.exchange_grade_level
      ),
    studentTypeOtherText:
      parseNullableString(
        value.student_type_other_text
      ),
    age: value.age,
    bio: value.bio,
    languages: parseLanguages(
      value.languages
    ),
    tags: parseTags(value.tags),
  }
}

export async function searchProfiles(
  searchQuery: string
): Promise<SearchProfilesResponse> {
  const normalizedQuery =
    searchQuery.trim()

  if (!normalizedQuery) {
    return {
      ok: false,
      error:
        '検索したい内容を入力してください。',
    }
  }

  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return {
      ok: false,
      error:
        '検索するにはログインしてください。',
    }
  }

  let parsedQuery

  try {
    parsedQuery = await parseSearchQuery(
      normalizedQuery
    )
  } catch (error: unknown) {
    console.error(
      'Search query parsing failed:',
      error
    )

    return {
      ok: false,
      error:
        '検索条件を解析できませんでした。表現を変えて再度お試しください。',
    }
  }

  if (
    !hasEffectiveSearchCriteria(
      parsedQuery
    )
  ) {
    return {
      ok: false,
      error:
        '言語、興味、経験、学生区分、年齢など、探したい条件をもう少し具体的に入力してください。',
    }
  }

  const {
    data: publicProfiles,
    error: profilesError,
  } = await supabase
    .from('public_profiles')
    .select(
      `
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
      `
    )
    .limit(500)

  if (profilesError) {
    console.error(
      'Public profile search load failed:',
      profilesError
    )

    return {
      ok: false,
      error:
        '公開プロフィールを読み込めませんでした。',
    }
  }

  const searchableProfiles = (
    publicProfiles ?? []
  )
    .map(parseSearchableProfile)
    .filter(
      (
        profile
      ): profile is SearchablePublicProfile =>
        profile !== null
    )

  const results = matchPublicProfiles(
    searchableProfiles,
    parsedQuery
  )

  return {
    ok: true,
    results,
  }
}