import Link from 'next/link'
import { redirect } from 'next/navigation'

import { searchProfiles } from '@/app/search/actions'
import type {
  MatchLevel,
  PublicProfileLanguage,
} from '@/lib/search/matcher'
import { createClient } from '@/lib/supabase/server'

type SearchPageProps = {
  searchParams: Promise<{
    q?: string
  }>
}

function studentTypeLabel(
  studentType: string,
  cohortNumber: number | null,
  exchangeGradeLevel: string | null,
  studentTypeOtherText: string | null
) {
  switch (studentType) {
    case 'regular':
      return cohortNumber !== null
        ? `正規学生・第${cohortNumber}期`
        : '正規学生'

    case 'exchange':
      return exchangeGradeLevel
        ? `交換留学生・${exchangeGradeLevel}`
        : '交換留学生'

    case 'graduate':
      return '大学院生'

    case 'other':
      return studentTypeOtherText
        ? `その他・${studentTypeOtherText}`
        : 'その他'

    default:
      return studentType
  }
}

function languageStatusLabels(
  language: PublicProfileLanguage
) {
  const labels: string[] = []

  if (language.isNative) {
    labels.push('母語')
  }

  if (language.canSpeak) {
    labels.push('話せる')
  }

  if (language.isLearning) {
    labels.push('学習中')
  }

  if (language.wantsToInteract) {
    labels.push('交流したい')
  }

  return labels
}

function matchLevelLabel(
  level: MatchLevel
) {
  switch (level) {
    case 'direct':
      return '直接一致'

    case 'equivalent':
      return '同義語・翻訳一致'

    case 'close_concept':
      return '近い概念'
  }
}

export default async function SearchPage({
  searchParams,
}: SearchPageProps) {
  const { q = '' } = await searchParams
  const searchQuery = q.trim()

  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const response = searchQuery
    ? await searchProfiles(searchQuery)
    : null

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-10">
      <div className="mx-auto w-full max-w-5xl">
        <section className="rounded-2xl bg-white p-8 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-blue-700">
                Campus Tag
              </p>

              <h1 className="mt-1 text-2xl font-semibold text-gray-900">
                学生プロフィール検索
              </h1>

              <p className="mt-2 text-sm text-gray-500">
                会いたい学生の特徴を、自然な文章で入力してください。
              </p>
            </div>

            <div className="flex flex-wrap gap-4 text-sm">
              <Link
                href="/profile/edit"
                className="text-gray-700 underline"
              >
                プロフィール設定
              </Link>

              <Link
                href="/profile/publication"
                className="text-gray-700 underline"
              >
                公開設定
              </Link>

              <Link
                href="/account"
                className="text-gray-700 underline"
              >
                アカウント
              </Link>
            </div>
          </div>

          <form
            method="get"
            action="/search"
            className="mt-8"
          >
            <label
              htmlFor="q"
              className="block text-sm font-medium text-gray-900"
            >
              検索内容
            </label>

            <textarea
              id="q"
              name="q"
              required
              maxLength={200}
              defaultValue={searchQuery}
              rows={4}
              placeholder="例：アラビア語を学習していて、留学に興味がある学生"
              className="mt-2 w-full resize-y rounded-xl border border-gray-300 px-4 py-3 text-gray-900 outline-none focus:border-blue-500"
            />

            <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-gray-500">
                言語・興味・経験・学生区分・年齢などを、最大200文字で入力できます。
              </p>

              <button
                type="submit"
                className="rounded-lg bg-gray-900 px-6 py-3 font-medium text-white hover:bg-gray-800"
              >
                検索する
              </button>
            </div>
          </form>

          <div className="mt-6 rounded-lg bg-blue-50 p-4 text-sm text-blue-800">
            検索結果は、本人が公開を許可したプロフィールと、安全確認済みの情報だけから生成されます。
          </div>
        </section>

        {response && !response.ok && (
          <p className="mt-6 rounded-xl bg-red-50 p-4 text-sm text-red-700">
            {response.error}
          </p>
        )}

        {response?.ok && (
          <section className="mt-8">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">
                  検索結果
                </h2>

                <p className="mt-1 text-sm text-gray-500">
                  「{searchQuery}」に一致する学生を表示しています。
                </p>
              </div>

              <p className="text-sm text-gray-600">
                {response.results.length}件
              </p>
            </div>

            {response.results.length === 0 ? (
              <div className="mt-4 rounded-2xl bg-white p-8 text-center shadow-sm">
                <p className="font-medium text-gray-900">
                  条件に一致する公開プロフィールはありませんでした。
                </p>

                <p className="mt-2 text-sm text-gray-500">
                  条件を減らすか、別の表現で検索してください。
                </p>
              </div>
            ) : (
              <ul className="mt-4 grid gap-5">
                {response.results.map(
                  (profile) => (
                    <li
                      key={profile.profileId}
                      className="rounded-2xl bg-white p-6 shadow-sm"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div>
                          <h3 className="text-xl font-semibold text-gray-900">
                            {profile.displayName}
                          </h3>

                          <p className="mt-1 text-sm text-gray-500">
                            {studentTypeLabel(
                              profile.studentType,
                              profile.cohortNumber,
                              profile.exchangeGradeLevel,
                              profile.studentTypeOtherText
                            )}
                            ・{profile.age}歳
                          </p>
                        </div>

                        <span className="rounded-full bg-green-50 px-3 py-1 text-xs font-medium text-green-700">
                          公開プロフィール
                        </span>
                      </div>

                      <p className="mt-5 whitespace-pre-wrap text-sm leading-7 text-gray-700">
                        {profile.bio}
                      </p>

                      {profile.languages.length >
                        0 && (
                        <div className="mt-6">
                          <h4 className="text-sm font-semibold text-gray-900">
                            言語
                          </h4>

                          <ul className="mt-2 grid gap-2 sm:grid-cols-2">
                            {profile.languages.map(
                              (language) => {
                                const statuses =
                                  languageStatusLabels(
                                    language
                                  )

                                return (
                                  <li
                                    key={
                                      language.code
                                    }
                                    className="rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-700"
                                  >
                                    <span className="font-medium">
                                      {
                                        language.nameJa
                                      }
                                    </span>

                                    <span className="ml-2 text-xs text-gray-500">
                                      {statuses.join(
                                        '・'
                                      )}
                                    </span>
                                  </li>
                                )
                              }
                            )}
                          </ul>
                        </div>
                      )}

                      {profile.tags.length > 0 && (
                        <div className="mt-6">
                          <h4 className="text-sm font-semibold text-gray-900">
                            タグ
                          </h4>

                          <div className="mt-2 flex flex-wrap gap-2">
                            {profile.tags.map(
                              (tag) => (
                                <span
                                  key={tag}
                                  className="rounded-full bg-blue-50 px-3 py-1 text-sm text-blue-800"
                                >
                                  {tag}
                                </span>
                              )
                            )}
                          </div>
                        </div>
                      )}

                      {profile.matchedConditions
                        .length > 0 && (
                        <div className="mt-6 rounded-xl border border-blue-100 bg-blue-50 p-4">
                          <h4 className="text-sm font-semibold text-blue-900">
                            この学生が表示された理由
                          </h4>

                          <ul className="mt-2 space-y-2">
                            {profile.matchedConditions.map(
                              (
                                condition,
                                index
                              ) => (
                                <li
                                  key={`${condition.source}-${condition.label}-${index}`}
                                  className="text-sm text-blue-800"
                                >
                                  ・
                                  {
                                    condition.label
                                  }
                                  ：
                                  {
                                    condition.matchedValue
                                  }
                                  （
                                  {matchLevelLabel(
                                    condition.level
                                  )}
                                  ）
                                </li>
                              )
                            )}
                          </ul>
                        </div>
                      )}
                    </li>
                  )
                )}
              </ul>
            )}
          </section>
        )}

        {!response && (
          <section className="mt-8 rounded-2xl bg-white p-8 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900">
              検索例
            </h2>

            <ul className="mt-4 space-y-3 text-sm text-gray-600">
              <li>
                ・アラビア語を学習している学生
              </li>
              <li>
                ・留学と起業に興味がある学生
              </li>
              <li>
                ・英語を話せる交換留学生
              </li>
            </ul>
          </section>
        )}
      </div>
    </main>
  )
}