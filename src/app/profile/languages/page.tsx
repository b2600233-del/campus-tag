import Link from 'next/link'
import { redirect } from 'next/navigation'

import { saveProfileLanguagesAction } from '@/app/profile/actions'
import { createClient } from '@/lib/supabase/server'

type LanguagesPageProps = {
  searchParams: Promise<{
    error?: string
    message?: string
  }>
}

export default async function LanguagesPage({
  searchParams,
}: LanguagesPageProps) {
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
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (profileError) {
    const params = new URLSearchParams({
      error: `プロフィールを確認できませんでした: ${profileError.message}`,
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

  const [
    {
      data: languages,
      error: languagesError,
    },
    {
      data: profileLanguages,
      error: profileLanguagesError,
    },
  ] = await Promise.all([
    supabase
      .from('languages')
      .select('id, code, name_en, name_ja')
      .eq('is_active', true)
      .order('name_ja'),
    supabase
      .from('profile_languages')
      .select(
        `
          language_id,
          is_native,
          can_speak,
          is_learning,
          wants_to_interact
        `
      )
      .eq('profile_id', profile.id),
  ])

  const loadError =
    languagesError?.message ??
    profileLanguagesError?.message ??
    ''

  const displayedError =
    error ??
    (loadError
      ? `言語設定を読み込めませんでした: ${loadError}`
      : '')

  const profileLanguageMap = new Map(
    (profileLanguages ?? []).map((item) => [
      item.language_id,
      item,
    ])
  )

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-10">
      <div className="mx-auto w-full max-w-5xl rounded-2xl bg-white p-8 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-blue-700">
              プロフィール設定
            </p>

            <h1 className="mt-1 text-2xl font-semibold text-gray-900">
              言語設定
            </h1>

            <p className="mt-2 text-sm text-gray-500">
              各言語について、当てはまる項目を選択してください。
            </p>
          </div>

          <div className="flex gap-4 text-sm">
            <Link
              href="/profile/edit"
              className="text-gray-700 underline"
            >
              基本プロフィール
            </Link>

            <Link
              href="/account"
              className="text-gray-700 underline"
            >
              アカウント
            </Link>
          </div>
        </div>

        <div className="mt-6 rounded-lg bg-blue-50 p-4 text-sm text-blue-800">
          公開プロフィールには、少なくとも1つの母語が必要です。
          同じ言語に複数の項目を設定できます。
        </div>

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

        <form
          action={saveProfileLanguagesAction}
          className="mt-8"
        >
          <div className="grid gap-4 md:grid-cols-2">
            {(languages ?? []).map((language) => {
              const selection =
                profileLanguageMap.get(language.id)

              return (
                <fieldset
                  key={language.id}
                  className="rounded-xl border border-gray-200 p-4"
                >
                  <legend className="px-1 font-semibold text-gray-900">
                    {language.name_ja}
                  </legend>

                  <p className="mb-3 text-xs text-gray-500">
                    {language.name_en}・{language.code}
                  </p>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="flex items-center gap-2 text-sm text-gray-700">
                      <input
                        type="checkbox"
                        name="nativeLanguageIds"
                        value={language.id}
                        defaultChecked={
                          selection?.is_native ?? false
                        }
                        className="h-4 w-4"
                      />
                      母語
                    </label>

                    <label className="flex items-center gap-2 text-sm text-gray-700">
                      <input
                        type="checkbox"
                        name="speakingLanguageIds"
                        value={language.id}
                        defaultChecked={
                          selection?.can_speak ?? false
                        }
                        className="h-4 w-4"
                      />
                      話せる
                    </label>

                    <label className="flex items-center gap-2 text-sm text-gray-700">
                      <input
                        type="checkbox"
                        name="learningLanguageIds"
                        value={language.id}
                        defaultChecked={
                          selection?.is_learning ?? false
                        }
                        className="h-4 w-4"
                      />
                      学習中
                    </label>

                    <label className="flex items-center gap-2 text-sm text-gray-700">
                      <input
                        type="checkbox"
                        name="interactionLanguageIds"
                        value={language.id}
                        defaultChecked={
                          selection?.wants_to_interact ??
                          false
                        }
                        className="h-4 w-4"
                      />
                      交流したい
                    </label>
                  </div>
                </fieldset>
              )
            })}
          </div>

          {(languages ?? []).length === 0 && (
            <p className="rounded-lg bg-yellow-50 p-4 text-sm text-yellow-800">
              選択可能な言語が登録されていません。
            </p>
          )}

          <button
            type="submit"
            disabled={(languages ?? []).length === 0}
            className="mt-8 w-full rounded-lg bg-gray-900 px-4 py-3 font-medium text-white disabled:opacity-50"
          >
            言語設定を保存
          </button>
        </form>

        <p className="mt-6 text-sm text-gray-500">
          タグと公開設定は次のステップで追加します。
        </p>
      </div>
    </main>
  )
}