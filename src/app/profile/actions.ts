'use server'

import { redirect } from 'next/navigation'

import { createClient } from '@/lib/supabase/server'

const STUDENT_TYPES = [
  'regular',
  'exchange',
  'graduate',
  'other',
] as const

type StudentType = (typeof STUDENT_TYPES)[number]

function getFormValue(formData: FormData, key: string) {
  const value = formData.get(key)

  return typeof value === 'string' ? value.trim() : ''
}

function isStudentType(value: string): value is StudentType {
  return STUDENT_TYPES.some(
    (studentType) => studentType === value
  )
}

function redirectWithMessage(
  key: 'error' | 'message',
  message: string
): never {
  const params = new URLSearchParams({
    [key]: message,
  })

  redirect(`/profile/edit?${params.toString()}`)
}

function isValidDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false
  }

  const date = new Date(`${value}T00:00:00Z`)

  return (
    !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value
  )
}

export async function saveBasicProfileAction(
  formData: FormData
) {
  const displayName = getFormValue(
    formData,
    'displayName'
  )
  const studentTypeValue = getFormValue(
    formData,
    'studentType'
  )
  const cohortNumberValue = getFormValue(
    formData,
    'cohortNumber'
  )
  const exchangeGradeLevel = getFormValue(
    formData,
    'exchangeGradeLevel'
  )
  const studentTypeOtherText = getFormValue(
    formData,
    'studentTypeOtherText'
  )
  const birthDate = getFormValue(formData, 'birthDate')
  const bio = getFormValue(formData, 'bio')

  if (
    !displayName ||
    !studentTypeValue ||
    !birthDate ||
    !bio
  ) {
    redirectWithMessage(
      'error',
      '表示名、学生区分、生年月日、自己紹介を入力してください。'
    )
  }

  if (!isStudentType(studentTypeValue)) {
    redirectWithMessage(
      'error',
      '学生区分が正しくありません。'
    )
  }

  if (!isValidDate(birthDate)) {
    redirectWithMessage(
      'error',
      '生年月日を正しく入力してください。'
    )
  }

  const today = new Date().toISOString().slice(0, 10)

  if (birthDate > today) {
    redirectWithMessage(
      'error',
      '未来の日付は生年月日に設定できません。'
    )
  }

  let cohortNumber: number | null = null

  if (studentTypeValue === 'regular') {
    cohortNumber = Number(cohortNumberValue)

    if (
      !Number.isInteger(cohortNumber) ||
      cohortNumber <= 0
    ) {
      redirectWithMessage(
        'error',
        '通常学生は期生番号を正しく入力してください。'
      )
    }
  }

  if (
    studentTypeValue === 'exchange' &&
    !exchangeGradeLevel
  ) {
    redirectWithMessage(
      'error',
      '交換留学生は学年を入力してください。'
    )
  }

  if (
    studentTypeValue === 'other' &&
    !studentTypeOtherText
  ) {
    redirectWithMessage(
      'error',
      'その他の学生区分を入力してください。'
    )
  }

  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { error } = await supabase
    .from('profiles')
    .upsert(
      {
        user_id: user.id,
        display_name: displayName,
        student_type: studentTypeValue,
        cohort_number: cohortNumber,
        exchange_grade_level:
          studentTypeValue === 'exchange'
            ? exchangeGradeLevel
            : null,
        student_type_other_text:
          studentTypeValue === 'other'
            ? studentTypeOtherText
            : null,
        birth_date: birthDate,
        bio,
      },
      {
        onConflict: 'user_id',
      }
    )

  if (error) {
    redirectWithMessage(
      'error',
      `プロフィールを保存できませんでした: ${error.message}`
    )
  }

  redirectWithMessage(
    'message',
    '基本プロフィールを保存しました。'
  )
}

function getFormValues(
  formData: FormData,
  key: string
) {
  return formData
    .getAll(key)
    .filter(
      (value): value is string =>
        typeof value === 'string'
    )
}

function redirectFromLanguages(
  key: 'error' | 'message',
  message: string
): never {
  const params = new URLSearchParams({
    [key]: message,
  })

  redirect(`/profile/languages?${params.toString()}`)
}

export async function saveProfileLanguagesAction(
  formData: FormData
) {
  const nativeLanguageIds = new Set(
    getFormValues(formData, 'nativeLanguageIds')
  )
  const speakingLanguageIds = new Set(
    getFormValues(formData, 'speakingLanguageIds')
  )
  const learningLanguageIds = new Set(
    getFormValues(formData, 'learningLanguageIds')
  )
  const interactionLanguageIds = new Set(
    getFormValues(
      formData,
      'interactionLanguageIds'
    )
  )

  if (nativeLanguageIds.size === 0) {
    redirectFromLanguages(
      'error',
      '母語を1つ以上選択してください。'
    )
  }

  const selectedLanguageIds = [
    ...new Set([
      ...nativeLanguageIds,
      ...speakingLanguageIds,
      ...learningLanguageIds,
      ...interactionLanguageIds,
    ]),
  ]

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
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (profileError || !profile) {
    const params = new URLSearchParams({
      error:
        '先に基本プロフィールを保存してください。',
    })

    redirect(`/profile/edit?${params.toString()}`)
  }

  const {
    data: activeLanguages,
    error: languagesError,
  } = await supabase
    .from('languages')
    .select('id')
    .in('id', selectedLanguageIds)
    .eq('is_active', true)

  if (
    languagesError ||
    !activeLanguages ||
    activeLanguages.length !==
      selectedLanguageIds.length
  ) {
    redirectFromLanguages(
      'error',
      '選択された言語を確認できませんでした。'
    )
  }

  const { error: deleteError } = await supabase
    .from('profile_languages')
    .delete()
    .eq('profile_id', profile.id)

  if (deleteError) {
    redirectFromLanguages(
      'error',
      `以前の言語設定を更新できませんでした: ${deleteError.message}`
    )
  }

  const languageRows = selectedLanguageIds.map(
    (languageId) => ({
      profile_id: profile.id,
      language_id: languageId,
      is_native: nativeLanguageIds.has(languageId),
      can_speak: speakingLanguageIds.has(languageId),
      is_learning: learningLanguageIds.has(languageId),
      wants_to_interact:
        interactionLanguageIds.has(languageId),
    })
  )

  const { error: insertError } = await supabase
    .from('profile_languages')
    .insert(languageRows)

  if (insertError) {
    redirectFromLanguages(
      'error',
      `言語設定を保存できませんでした: ${insertError.message}`
    )
  }

  redirectFromLanguages(
    'message',
    '言語設定を保存しました。'
  )
}