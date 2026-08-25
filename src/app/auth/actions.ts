'use server'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

import { createClient } from '@/lib/supabase/server'

const AIU_STUDENT_DOMAIN = 'gl.aiu.ac.jp'
const MIN_PASSWORD_LENGTH = 8

function getFormValue(formData: FormData, key: string) {
  const value = formData.get(key)

  return typeof value === 'string' ? value.trim() : ''
}

function isAiuStudentEmail(email: string) {
  const parts = email.toLowerCase().split('@')

  return (
    parts.length === 2 &&
    parts[0].length > 0 &&
    parts[1] === AIU_STUDENT_DOMAIN
  )
}

function redirectWithMessage(
  path: string,
  key: 'error' | 'message',
  message: string
): never {
  const params = new URLSearchParams({
    [key]: message,
  })

  redirect(`${path}?${params.toString()}`)
}

async function getRequestOrigin() {
  const headerStore = await headers()

  const origin = headerStore.get('origin')

  if (origin) {
    return origin
  }

  const host =
    headerStore.get('x-forwarded-host') ??
    headerStore.get('host')

  if (!host) {
    return 'http://localhost:3000'
  }

  const protocol =
    headerStore.get('x-forwarded-proto') ??
    (host.includes('localhost') ? 'http' : 'https')

  return `${protocol}://${host}`
}

export async function signupAction(formData: FormData) {
  const email = getFormValue(formData, 'email').toLowerCase()
  const password = getFormValue(formData, 'password')

  if (!email || !password) {
    redirectWithMessage(
      '/signup',
      'error',
      'メールアドレスとパスワードを入力してください。'
    )
  }

  if (!isAiuStudentEmail(email)) {
    redirectWithMessage(
      '/signup',
      'error',
      'AIU学生メール（@gl.aiu.ac.jp）を使用してください。'
    )
  }

  if (password.length < MIN_PASSWORD_LENGTH) {
    redirectWithMessage(
      '/signup',
      'error',
      `パスワードは${MIN_PASSWORD_LENGTH}文字以上にしてください。`
    )
  }

  const supabase = await createClient()
  const origin = await getRequestOrigin()

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${origin}/auth/callback?next=/account`,
    },
  })

  if (error) {
    redirectWithMessage(
      '/signup',
      'error',
      `登録処理に失敗しました: ${error.message}`
    )
  }

  redirectWithMessage(
    '/signup',
    'message',
    '確認メールを送信しました。メール内のリンクを開いて登録を完了してください。'
  )
}

export async function loginAction(formData: FormData) {
  const email = getFormValue(formData, 'email').toLowerCase()
  const password = getFormValue(formData, 'password')

  if (!email || !password) {
    redirectWithMessage(
      '/login',
      'error',
      'メールアドレスとパスワードを入力してください。'
    )
  }

  const supabase = await createClient()

  const {
    data,
    error,
  } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error || !data.user) {
    redirectWithMessage(
      '/login',
      'error',
      'ログインできませんでした。メール確認の完了状況と入力内容を確認してください。'
    )
  }

  const { error: bootstrapError } = await supabase.rpc(
    'bootstrap_current_user'
  )

  if (bootstrapError) {
    await supabase.auth.signOut()

    if (bootstrapError.message.includes('AIU_EMAIL_REQUIRED')) {
      redirectWithMessage(
        '/login',
        'error',
        'このアカウントはCampus Tagの学生登録条件を満たしていません。'
      )
    }

    if (bootstrapError.message.includes('EMAIL_NOT_VERIFIED')) {
      redirectWithMessage(
        '/login',
        'error',
        'メールアドレスの確認が完了していません。'
      )
    }

    redirectWithMessage(
      '/login',
      'error',
      'Campus Tagアカウントの初期化に失敗しました。'
    )
  }

  const { data: appUser, error: accountError } = await supabase
    .from('app_users')
    .select('account_status')
    .eq('id', data.user.id)
    .single()

  if (
    accountError ||
    !appUser ||
    appUser.account_status !== 'active'
  ) {
    await supabase.auth.signOut()

    redirectWithMessage(
      '/login',
      'error',
      'このCampus Tagアカウントは現在利用できません。'
    )
  }

  redirect('/account')
}

export async function logoutAction() {
  const supabase = await createClient()

  await supabase.auth.signOut()

  redirectWithMessage(
    '/login',
    'message',
    'ログアウトしました。'
  )
}

export async function requestPasswordResetAction(
  formData: FormData
) {
  const email = getFormValue(formData, 'email').toLowerCase()

  if (!email) {
    redirectWithMessage(
      '/forgot-password',
      'error',
      'メールアドレスを入力してください。'
    )
  }

  /*
   * Student self-service password reset only.
   * Demo accounts use non-AIU email addresses and are managed
   * by the system owner.
   */
  if (!isAiuStudentEmail(email)) {
    redirectWithMessage(
      '/forgot-password',
      'error',
      '学生用パスワード再設定はAIU学生メールのみ利用できます。'
    )
  }

  const supabase = await createClient()
  const origin = await getRequestOrigin()

  const { error } = await supabase.auth.resetPasswordForEmail(
    email,
    {
      redirectTo: `${origin}/auth/callback?next=/update-password`,
    }
  )

  if (error) {
    redirectWithMessage(
      '/forgot-password',
      'error',
      `再設定メールを送信できませんでした: ${error.message}`
    )
  }

  redirectWithMessage(
    '/forgot-password',
    'message',
    '対象のアカウントが存在する場合、パスワード再設定メールが送信されます。'
  )
}

export async function updatePasswordAction(
  formData: FormData
) {
  const password = getFormValue(formData, 'password')
  const passwordConfirmation = getFormValue(
    formData,
    'passwordConfirmation'
  )

  if (!password || !passwordConfirmation) {
    redirectWithMessage(
      '/update-password',
      'error',
      '新しいパスワードを入力してください。'
    )
  }

  if (password.length < MIN_PASSWORD_LENGTH) {
    redirectWithMessage(
      '/update-password',
      'error',
      `パスワードは${MIN_PASSWORD_LENGTH}文字以上にしてください。`
    )
  }

  if (password !== passwordConfirmation) {
    redirectWithMessage(
      '/update-password',
      'error',
      '確認用パスワードが一致していません。'
    )
  }

  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirectWithMessage(
      '/login',
      'error',
      'パスワード再設定セッションが確認できません。もう一度再設定メールを送信してください。'
    )
  }

  const { error } = await supabase.auth.updateUser({
    password,
  })

  if (error) {
    redirectWithMessage(
      '/update-password',
      'error',
      `パスワードを更新できませんでした: ${error.message}`
    )
  }

  await supabase.auth.signOut()

  redirectWithMessage(
    '/login',
    'message',
    'パスワードを更新しました。新しいパスワードでログインしてください。'
  )
}