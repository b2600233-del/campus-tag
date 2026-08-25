import { type NextRequest, NextResponse } from 'next/server'

import { createClient } from '@/lib/supabase/server'

function getSafeNextPath(value: string | null) {
  if (
    value &&
    value.startsWith('/') &&
    !value.startsWith('//')
  ) {
    return value
  }

  return '/account'
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl

  const code = searchParams.get('code')
  const next = getSafeNextPath(searchParams.get('next'))

  if (!code) {
    return NextResponse.redirect(
      new URL(
        '/login?error=メール認証コードを確認できませんでした。',
        request.url
      )
    )
  }

  const supabase = await createClient()

  const { error } =
    await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    return NextResponse.redirect(
      new URL(
        '/login?error=メール認証に失敗しました。リンクの有効期限を確認してください。',
        request.url
      )
    )
  }

  /*
   * Password recovery already belongs to an existing user.
   * Do not run student bootstrap during the password-update flow.
   */
  if (next === '/update-password') {
    return NextResponse.redirect(
      new URL('/update-password', request.url)
    )
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    await supabase.auth.signOut()

    return NextResponse.redirect(
      new URL(
        '/login?error=認証済みユーザーを確認できませんでした。',
        request.url
      )
    )
  }

  const { error: bootstrapError } = await supabase.rpc(
    'bootstrap_current_user'
  )

  if (bootstrapError) {
    await supabase.auth.signOut()

    return NextResponse.redirect(
      new URL(
        '/login?error=Campus Tagアカウントを作成できませんでした。',
        request.url
      )
    )
  }

  const { data: appUser, error: accountError } =
    await supabase
      .from('app_users')
      .select('account_status')
      .eq('id', user.id)
      .single()

  if (
    accountError ||
    !appUser ||
    appUser.account_status !== 'active'
  ) {
    await supabase.auth.signOut()

    return NextResponse.redirect(
      new URL(
        '/login?error=このCampus Tagアカウントは現在利用できません。',
        request.url
      )
    )
  }

  return NextResponse.redirect(
    new URL(next, request.url)
  )
}