import Link from 'next/link'
import { redirect } from 'next/navigation'

import { saveBasicProfileAction } from '@/app/profile/actions'
import { createClient } from '@/lib/supabase/server'

type ProfileEditPageProps = {
  searchParams: Promise<{
    error?: string
    message?: string
  }>
}

export default async function ProfileEditPage({
  searchParams,
}: ProfileEditPageProps) {
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
        display_name,
        student_type,
        cohort_number,
        exchange_grade_level,
        student_type_other_text,
        birth_date,
        bio
      `
    )
    .eq('user_id', user.id)
    .maybeSingle()

  const displayedError =
    error ??
    (profileError
      ? `プロフィールを読み込めませんでした: ${profileError.message}`
      : '')

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-10">
      <div className="mx-auto w-full max-w-2xl rounded-2xl bg-white p-8 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-blue-700">
              プロフィール設定
            </p>

            <h1 className="mt-1 text-2xl font-semibold text-gray-900">
              基本プロフィール
            </h1>

            <p className="mt-2 text-sm text-gray-500">
              Campus Tagで使用する基本情報を入力してください。
            </p>
          </div>

          <Link
            href="/account"
            className="text-sm text-gray-700 underline"
          >
            アカウントへ戻る
          </Link>
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
          action={saveBasicProfileAction}
          className="mt-8 space-y-6"
        >
          <div>
            <label
              htmlFor="displayName"
              className="block text-sm font-medium text-gray-700"
            >
              表示名
            </label>

            <input
              id="displayName"
              name="displayName"
              type="text"
              required
              defaultValue={profile?.display_name ?? ''}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900"
              placeholder="Campus Tagで表示する名前"
            />
          </div>

          <div>
            <label
              htmlFor="studentType"
              className="block text-sm font-medium text-gray-700"
            >
              学生区分
            </label>

            <select
              id="studentType"
              name="studentType"
              required
              defaultValue={profile?.student_type ?? ''}
              className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900"
            >
              <option value="">
                学生区分を選択してください
              </option>
              <option value="regular">
                正規学部生
              </option>
              <option value="exchange">
                交換留学生
              </option>
              <option value="graduate">
                大学院生
              </option>
              <option value="other">
                その他
              </option>
            </select>
          </div>

          <div>
            <label
              htmlFor="cohortNumber"
              className="block text-sm font-medium text-gray-700"
            >
              期生番号
            </label>

            <p className="mt-1 text-xs text-gray-500">
              正規学部生の場合のみ入力してください。
            </p>

            <input
              id="cohortNumber"
              name="cohortNumber"
              type="number"
              min="1"
              defaultValue={profile?.cohort_number ?? ''}
              className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900"
              placeholder="例: 22"
            />
          </div>

          <div>
            <label
              htmlFor="exchangeGradeLevel"
              className="block text-sm font-medium text-gray-700"
            >
              交換留学生の学年
            </label>

            <p className="mt-1 text-xs text-gray-500">
              交換留学生の場合のみ入力してください。
            </p>

            <input
              id="exchangeGradeLevel"
              name="exchangeGradeLevel"
              type="text"
              defaultValue={
                profile?.exchange_grade_level ?? ''
              }
              className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900"
              placeholder="例: 2年生"
            />
          </div>

          <div>
            <label
              htmlFor="studentTypeOtherText"
              className="block text-sm font-medium text-gray-700"
            >
              その他の学生区分
            </label>

            <p className="mt-1 text-xs text-gray-500">
              「その他」を選択した場合のみ入力してください。
            </p>

            <input
              id="studentTypeOtherText"
              name="studentTypeOtherText"
              type="text"
              defaultValue={
                profile?.student_type_other_text ?? ''
              }
              className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900"
              placeholder="学生区分を入力"
            />
          </div>

          <div>
            <label
              htmlFor="birthDate"
              className="block text-sm font-medium text-gray-700"
            >
              生年月日
            </label>

            <p className="mt-1 text-xs text-gray-500">
              生年月日は公開されず、公開画面には年齢だけが表示されます。
            </p>

            <input
              id="birthDate"
              name="birthDate"
              type="date"
              required
              defaultValue={profile?.birth_date ?? ''}
              className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900"
            />
          </div>

          <div>
            <label
              htmlFor="bio"
              className="block text-sm font-medium text-gray-700"
            >
              自己紹介
            </label>

            <textarea
              id="bio"
              name="bio"
              required
              rows={6}
              defaultValue={profile?.bio ?? ''}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900"
              placeholder="興味のあることや交流したい内容を書いてください。"
            />
          </div>

          <button
            type="submit"
            className="w-full rounded-lg bg-gray-900 px-4 py-3 font-medium text-white hover:bg-gray-800"
          >
            基本プロフィールを保存
          </button>
        </form>

        <p className="mt-6 text-sm text-gray-500">
          言語、タグ、公開設定は次のステップで追加します。
        </p>
      </div>
    </main>
  )
}