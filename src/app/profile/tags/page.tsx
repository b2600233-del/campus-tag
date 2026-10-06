import Link from 'next/link'
import { redirect } from 'next/navigation'

import {
  adoptProfileTagCandidatesAction,
  deleteProfileTagAction,
  generateProfileTagCandidatesAction,
  saveProfileTagAction,
} from '@/app/profile/tags/actions'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

type StoredTagCandidate = {
  candidate_id: string
  tag_text: string
}

function readStoredCandidates(
  value: unknown,
): StoredTagCandidate[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value.flatMap((item) => {
    if (
      typeof item !== 'object' ||
      item === null ||
      typeof (item as Record<string, unknown>).candidate_id !==
        'string' ||
      typeof (item as Record<string, unknown>).tag_text !== 'string'
    ) {
      return []
    }

    return [
      {
        candidate_id: (item as Record<string, string>)
          .candidate_id,
        tag_text: (item as Record<string, string>).tag_text,
      },
    ]
  })
}

type TagsPageProps = {
  searchParams: Promise<{
    error?: string
    message?: string
  }>
}

export default async function TagsPage({
  searchParams,
}: TagsPageProps) {
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

  const {
    data: profileTags,
    error: tagsError,
  } = await supabase
    .from('profile_tags')
    .select(
      `
        id,
        tag_text,
        review_status,
        safety_screening_status
      `
    )
    .eq('profile_id', profile.id)
    .order('tag_text')

  const displayedError =
    error ??
    (tagsError
      ? `タグを読み込めませんでした: ${tagsError.message}`
      : '')

  const tags = profileTags ?? []

  const remainingTagCount = Math.max(
    0,
    12 - tags.length
  )

  const admin = createAdminClient()
  const { data: candidateBatch } = await admin
    .from('ai_tag_regeneration_batches')
    .select('id, candidate_payload, expires_at')
    .eq('user_id', user.id)
    .eq('profile_id', profile.id)
    .is('consumed_at', null)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const candidates = candidateBatch
    ? readStoredCandidates(candidateBatch.candidate_payload)
    : []

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-10">
      <div className="mx-auto w-full max-w-5xl rounded-2xl bg-white p-8 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-blue-700">
              プロフィール設定
            </p>

            <h1 className="mt-1 text-2xl font-semibold text-gray-900">
              タグ設定
            </h1>

            <p className="mt-2 text-sm text-gray-500">
              興味・経験・交流したいテーマをタグとして追加できます。
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

        <div className="mt-6 rounded-lg bg-blue-50 p-4 text-sm text-blue-800">
          タグは最大12個、1個につき60文字までです。
          追加したタグはAIによる安全確認を受けます。
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
          action={saveProfileTagAction}
          className="mt-8"
        >
          <label
            htmlFor="tagText"
            className="block text-sm font-medium text-gray-900"
          >
            新しいタグ
          </label>

          <div className="mt-2 flex flex-col gap-3 sm:flex-row">
            <input
              id="tagText"
              name="tagText"
              type="text"
              required
              maxLength={60}
              disabled={remainingTagCount === 0}
              placeholder="例：海外留学"
              className="min-w-0 flex-1 rounded-lg border border-gray-300 px-4 py-3 text-gray-900 outline-none focus:border-blue-500 disabled:bg-gray-100"
            />

            <button
              type="submit"
              disabled={remainingTagCount === 0}
              className="rounded-lg bg-gray-900 px-6 py-3 font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              タグを追加
            </button>
          </div>

          <p className="mt-2 text-xs text-gray-500">
            あと{remainingTagCount}個追加できます。
          </p>
        </form>

        <section className="mt-10 rounded-2xl border border-blue-200 bg-blue-50 p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">
                AIタグ候補
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                プロフィール内容に基づく候補です。採用したタグだけが保存されます。
              </p>
            </div>

            <form action={generateProfileTagCandidatesAction}>
              <button
                type="submit"
                disabled={remainingTagCount === 0}
                className="rounded-xl bg-blue-700 px-5 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {candidates.length > 0
                  ? '候補を再生成'
                  : '候補を生成'}
              </button>
            </form>
          </div>

          {candidateBatch && candidates.length > 0 ? (
            <form
              action={adoptProfileTagCandidatesAction}
              className="mt-5"
            >
              <input
                type="hidden"
                name="batchId"
                value={candidateBatch.id}
              />

              <div className="grid gap-3 sm:grid-cols-2">
                {candidates.map((candidate) => (
                  <label
                    key={candidate.candidate_id}
                    className="flex cursor-pointer items-start gap-3 rounded-xl border border-blue-200 bg-white p-4"
                  >
                    <input
                      type="checkbox"
                      name="candidateId"
                      value={candidate.candidate_id}
                      className="mt-1 h-4 w-4"
                    />
                    <span className="font-medium text-slate-900">
                      {candidate.tag_text}
                    </span>
                  </label>
                ))}
              </div>

              <button
                type="submit"
                className="mt-5 rounded-xl bg-slate-950 px-5 py-3 font-semibold text-white"
              >
                選択した候補を採用
              </button>
            </form>
          ) : (
            <p className="mt-5 text-sm text-slate-600">
              まだ候補は生成されていません。
            </p>
          )}
        </section>

        <section className="mt-10">
          <h2 className="text-lg font-semibold text-gray-900">
            登録済みのタグ
          </h2>

          {tags.length > 0 ? (
            <ul className="mt-4 grid gap-3 md:grid-cols-2">
              {tags.map((tag) => {
                const isPending =
                  tag.review_status ===
                    'needs_editor_review' ||
                  tag.safety_screening_status ===
                    'flagged'

                return (
                  <li
                    key={tag.id}
                    className="flex items-center justify-between gap-4 rounded-xl border border-gray-200 p-4"
                  >
                    <div className="min-w-0">
                      <p className="break-words font-medium text-gray-900">
                        {tag.tag_text}
                      </p>

                      <p
                        className={
                          isPending
                            ? 'mt-1 text-xs text-amber-700'
                            : 'mt-1 text-xs text-green-700'
                        }
                      >
                        {isPending
                          ? '確認待ち・現在は非公開'
                          : '公開可能'}
                      </p>
                    </div>

                    <form
                      action={deleteProfileTagAction}
                    >
                      <input
                        type="hidden"
                        name="tagId"
                        value={tag.id}
                      />

                      <button
                        type="submit"
                        className="shrink-0 rounded-lg border border-red-200 px-3 py-2 text-sm text-red-700 hover:bg-red-50"
                      >
                        削除
                      </button>
                    </form>
                  </li>
                )
              })}
            </ul>
          ) : (
            <p className="mt-4 rounded-lg bg-gray-50 p-4 text-sm text-gray-600">
              まだタグは登録されていません。
            </p>
          )}
        </section>
      </div>
    </main>
  )
}
