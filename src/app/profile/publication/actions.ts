'use server'

import { redirect } from 'next/navigation'

import { createClient } from '@/lib/supabase/server'

function getFormValue(
  formData: FormData,
  key: string
) {
  const value = formData.get(key)

  return typeof value === 'string'
    ? value.trim()
    : ''
}

function hasText(value: string | null) {
  return Boolean(value?.trim())
}

function redirectFromPublication(
  key: 'error' | 'message',
  message: string
): never {
  const params = new URLSearchParams({
    [key]: message,
  })

  redirect(
    `/profile/publication?${params.toString()}`
  )
}

export async function updateProfilePublicationAction(
  formData: FormData
) {
  const intent = getFormValue(
    formData,
    'intent'
  )

  if (
    intent !== 'publish' &&
    intent !== 'unpublish'
  ) {
    redirectFromPublication(
      'error',
      '公開設定を確認できませんでした。'
    )
  }

  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const {
    data: profile,
    error: profileError,
  } = await supabase
    .from('profiles')
    .select(
      `
        id,
        display_name,
        student_type,
        cohort_number,
        exchange_grade_level,
        student_type_other_text,
        birth_date,
        bio,
        is_public,
        is_forced_private
      `
    )
    .eq('user_id', user.id)
    .maybeSingle()

  if (profileError) {
    console.error(
      'Profile publication load failed:',
      profileError
    )

    redirectFromPublication(
      'error',
      'プロフィールを確認できませんでした。'
    )
  }

  if (!profile) {
    const params = new URLSearchParams({
      error:
        '先に基本プロフィールを保存してください。',
    })

    redirect(`/profile/edit?${params.toString()}`)
  }

  if (intent === 'unpublish') {
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        is_public: false,
      })
      .eq('id', profile.id)
      .eq('user_id', user.id)

    if (updateError) {
      console.error(
        'Profile unpublish failed:',
        updateError
      )

      redirectFromPublication(
        'error',
        'プロフィールを非公開にできませんでした。'
      )
    }

    redirectFromPublication(
      'message',
      'プロフィールを非公開にしました。'
    )
  }

  if (profile.is_forced_private) {
    redirectFromPublication(
      'error',
      '現在、運営により非公開に設定されています。'
    )
  }

  const basicProfileReady =
    hasText(profile.display_name) &&
    Boolean(profile.birth_date) &&
    hasText(profile.bio) &&
    (
      (
        profile.student_type === 'regular' &&
        profile.cohort_number !== null
      ) ||
      (
        profile.student_type === 'exchange' &&
        hasText(profile.exchange_grade_level)
      ) ||
      profile.student_type === 'graduate' ||
      (
        profile.student_type === 'other' &&
        hasText(
          profile.student_type_other_text
        )
      )
    )

  const {
    data: nativeLanguages,
    error: nativeLanguagesError,
  } = await supabase
    .from('profile_languages')
    .select('language_id')
    .eq('profile_id', profile.id)
    .eq('is_native', true)

  if (nativeLanguagesError) {
    console.error(
      'Native language load failed:',
      nativeLanguagesError
    )

    redirectFromPublication(
      'error',
      '母語設定を確認できませんでした。'
    )
  }

  const nativeLanguageIds = (
    nativeLanguages ?? []
  ).map((item) => item.language_id)

  let nativeLanguageReady = false

  if (nativeLanguageIds.length > 0) {
    const {
      data: activeLanguages,
      error: activeLanguagesError,
    } = await supabase
      .from('languages')
      .select('id')
      .in('id', nativeLanguageIds)
      .eq('is_active', true)
      .limit(1)

    if (activeLanguagesError) {
      console.error(
        'Active native language load failed:',
        activeLanguagesError
      )

      redirectFromPublication(
        'error',
        '母語設定を確認できませんでした。'
      )
    }

    nativeLanguageReady =
      (activeLanguages ?? []).length > 0
  }

  const {
    data: publicReadyTags,
    error: tagsError,
  } = await supabase
    .from('profile_tags')
    .select('id')
    .eq('profile_id', profile.id)
    .eq('review_status', 'clear')
    .in(
      'safety_screening_status',
      ['passed', 'flagged']
    )
    .limit(1)

  if (tagsError) {
    console.error(
      'Public-ready tag load failed:',
      tagsError
    )

    redirectFromPublication(
      'error',
      'タグ設定を確認できませんでした。'
    )
  }

  const tagReady =
    (publicReadyTags ?? []).length > 0

  if (
    !basicProfileReady ||
    !nativeLanguageReady ||
    !tagReady
  ) {
    redirectFromPublication(
      'error',
      '公開条件を満たしていません。未完了の項目を確認してください。'
    )
  }

  const { error: updateError } = await supabase
    .from('profiles')
    .update({
      is_public: true,
    })
    .eq('id', profile.id)
    .eq('user_id', user.id)

  if (updateError) {
    console.error(
      'Profile publish failed:',
      updateError
    )

    redirectFromPublication(
      'error',
      'プロフィールを公開できませんでした。'
    )
  }

  redirectFromPublication(
    'message',
    'プロフィールを公開しました。'
  )
}