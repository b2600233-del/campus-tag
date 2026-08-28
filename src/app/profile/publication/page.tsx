import Link from 'next/link'
import { redirect } from 'next/navigation'

import {
  updateProfilePublicationAction,
} from '@/app/profile/publication/actions'
import { createClient } from '@/lib/supabase/server'

type PublicationPageProps = {
  searchParams: Promise<{
    error?: string
    message?: string
  }>
}

function hasText(value: string | null) {
  return Boolean(value?.trim())
}

export default async function PublicationPage({
  searchParams,
}: PublicationPageProps) {
  const { error, message } = await searchParams

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
    const params = new URLSearchParams({
      error:
        `プロフィールを確認できませんでした: ${profileError.message}`,
    })

    redirect(`/profile/edit?${params.toString()}`)
  }

  if (!profile) {
    const params = new URLSearchParams({
      error:
        '先に基本プロフィールを保存してください。',
    })

    redirect(`/profile/edit?${params.toString()}`)
  }

  const {
    data: nativeLanguages,
    error: nativeLanguagesError,
  } = await supabase
    .from('profile_languages')
    .select('language_id')
    .eq('profile_id', profile.id)
    .eq('is_native', true)

  const nativeLanguageIds = (
    nativeLanguages ?? []
  ).map((item) => item.language_id)

  let nativeLanguageReady = false
  let activeLanguagesErrorMessage = ''

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

    activeLanguagesErrorMessage =
      activeLanguagesError?.message ?? ''

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

  const tagReady =
    (publicReadyTags ?? []).length > 0

  const loadError =
    nativeLanguagesError?.message ??
    activeLanguagesErrorMessage ??
    tagsError?.message ??
    ''

  const displayedError =
    error ??
    (loadError
      ? `公開条件を確認できませんでした: ${loadError}`
      : '')

  const publicationReady =
    basicProfileReady &&
    nativeLanguageReady &&
    tagReady &&
    !profile.is_forced_private &&
    !loadError

  const publiclyVisible =
    profile.is_public &&
    publicationReady

  const conditions = [
    {
      label:
        '基本プロフィールの必須項目が入力済み',
      ready: basicProfileReady,
      href: '/profile/edit',
      linkLabel: '基本プロフィールを確認',
    },
    {
      label:
        '有効な母語が1つ以上設定済み',
      ready: nativeLanguageReady,
      href: '/profile/languages',
      linkLabel: '言語設定を確認',
    },
    {
      label:
        '公開可能なタグが1つ以上登録済み',
      ready: tagReady,
      href: '/profile/tags',
      linkLabel: 'タグ設定を確認',
    },
    {
      label:
        '運営による強制非公開ではない',
      ready: !profile.is_forced_private,
      href: '/account',
      linkLabel: 'アカウントを確認',
    },
  ]

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-10">
      <div className="mx-auto w-full max-w-3xl rounded-2xl bg-white p-8 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-blue-700">
              プロフィール設定
            </p>

            <h1 className="mt-1 text-2xl font-semibold text-gray-900">
              公開設定
            </h1>

            <p className="mt-2 text-sm text-gray-500">
              検索結果にプロフィールを表示するか設定します。
            </p>
          </div>

          <div className="flex flex-wrap gap-4 text-sm">
            <Link
              href="/profile/edit"
              className="text-gray-700 underline"
            >
              基本プロフィール
            </Link>

            <Link
              href="/profile/languages"
              className="text-gray-700 underline"
            >
              言語設定
            </Link>

            <Link
              href="/profile/tags"
              className="text-gray-700 underline"
            >
              タグ設定
            </Link>

            <Link
              href="/account"
              className="text-gray-700 underline"
            >
              アカウント
            </Link>
          </div>
        </div>

        <section className="mt-8 rounded-xl border border-gray-200 p-5">
          <p className="text-sm font-medium text-gray-600">
            現在の公開状態
          </p>

          <p
            className={
              publiclyVisible
                ? 'mt-2 text-xl font-semibold text-green-700'
                : 'mt-2 text-xl font-semibold text-gray-800'
            }
          >
            {publiclyVisible
              ? '公開中'
              : profile.is_forced_private
                ? '運営により非公開'
                : profile.is_public
                  ? '公開条件未達のため非公開'
                  : '非公開'}
          </p>
        </section>

        {displayedError && (
          <p className="mt-6 rounded-lg bg-red-50 p-3 text-sm text-red-700">
            {displayedError}
          </p>
        )}

        {message && (
          <p className="mt-6 rounded-lg bg-green-50 p-3 text-sm text-green-700">
            {message}
          </p>
        )}

        <section className="mt-8">
          <h2 className="text-lg font-semibold text-gray-900">
            公開条件
          </h2>

          <ul className="mt-4 space-y-3">
            {conditions.map((condition) => (
              <li
                key={condition.label}
                className="flex flex-col gap-3 rounded-xl border border-gray-200 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex items-center gap-3">
                  <span
                    aria-hidden="true"
                    className={
                      condition.ready
                        ? 'text-lg text-green-700'
                        : 'text-lg text-red-600'
                    }
                  >
                    {condition.ready ? '✓' : '×'}
                  </span>

                  <span className="text-sm text-gray-800">
                    {condition.label}
                  </span>
                </div>

                {!condition.ready && (
                  <Link
                    href={condition.href}
                    className="text-sm text-blue-700 underline"
                  >
                    {condition.linkLabel}
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </section>

        <div className="mt-8 rounded-lg bg-blue-50 p-4 text-sm text-blue-800">
          公開後は、安全確認済みの情報だけが学生プロフィール検索に表示されます。
          いつでも非公開へ戻せます。
        </div>

        <form
          action={updateProfilePublicationAction}
          className="mt-8"
        >
          <input
            type="hidden"
            name="intent"
            value={
              profile.is_public
                ? 'unpublish'
                : 'publish'
            }
          />

          <button
            type="submit"
            disabled={
              profile.is_public
                ? false
                : !publicationReady
            }
            className={
              profile.is_public
                ? 'w-full rounded-lg border border-red-300 px-4 py-3 font-medium text-red-700 hover:bg-red-50'
                : 'w-full rounded-lg bg-gray-900 px-4 py-3 font-medium text-white disabled:cursor-not-allowed disabled:opacity-50'
            }
          >
            {profile.is_public
              ? 'プロフィールを非公開にする'
              : 'プロフィールを公開する'}
          </button>
        </form>

        {!profile.is_public &&
          !publicationReady && (
            <p className="mt-3 text-center text-sm text-gray-500">
              すべての公開条件を満たすと公開できます。
            </p>
          )}
      </div>
    </main>
  )
}