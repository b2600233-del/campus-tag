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