import Link from 'next/link'
import { redirect } from 'next/navigation'

import {
  approveEditorTagAction,
  escalateEditorTagAction,
} from '@/app/editor/tags/actions'
import { createClient } from '@/lib/supabase/server'

type EditorTagsPageProps = {
  searchParams: Promise<{
    error?: string
    message?: string
  }>
}

type EditorTagReview = {
  tag_id: string
  tag_text: string
  tag_source: string
  safety_reason_category: string | null
  safety_reason_summary: string | null
  safety_checked_at: string | null
  submitted_at: string
}

const SAFETY_REASON_LABELS: Record<
  string,
  string
> = {
  personal_information: '個人情報',
  inappropriate_content: '不適切な内容',
  harassment_or_attack: '嫌がらせ・攻撃',
  unsafe_or_illegal: '危険・違法行為',
  other: 'その他',
}

function getReasonLabel(
  category: string | null
) {
  if (!category) {
    return '理由未分類'
  }

  return (
    SAFETY_REASON_LABELS[category] ??
    category
  )
}

function getSourceLabel(source: string) {
  if (source === 'ai_generated') {
    return 'AI生成'
  }

  if (source === 'user_added') {
    return 'ユーザー追加'
  }

  return source
}

function formatDate(value: string | null) {
  if (!value) {
    return '日時未記録'
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return '日時未記録'
  }

  return new Intl.DateTimeFormat(
    'ja-JP',
    {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: 'Asia/Tokyo',
    }
  ).format(date)
}

export default async function EditorTagsPage({
  searchParams,
}: EditorTagsPageProps) {
  const { error, message } = await searchParams

  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const {
    data: queueData,
    error: queueError,
  } = await supabase.rpc(
    'get_editor_tag_review_queue',
    {
      p_limit: 50,
    }
  )

  if (
    queueError?.code === '42501'
  ) {
    return (
      <main className="min-h-screen bg-gray-50 px-4 py-10 text-gray-950">
        <section className="mx-auto max-w-3xl rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
          <p className="text-sm font-medium text-red-700">
            アクセスできません
          </p>

          <h1 className="mt-2 text-3xl font-bold">
            Editor権限が必要です
          </h1>

          <p className="mt-4 leading-7 text-gray-600">
            この画面は、EditorまたはAdminのみ利用できます。
          </p>

          <div className="mt-8 flex flex-wrap gap-4">
            <Link
              href="/search"
              className="rounded-lg bg-gray-950 px-5 py-3 font-medium text-white"
            >
              学生検索へ戻る
            </Link>

            <Link
              href="/account"
              className="rounded-lg border border-gray-300 px-5 py-3 font-medium"
            >
              アカウント
            </Link>
          </div>
        </section>
      </main>
    )
  }

  if (queueError) {
    console.error(
      'Editor review queue load failed:',
      queueError
    )
  }

  const reviewQueue = (
    queueData ?? []
  ) as EditorTagReview[]

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-10 text-gray-950">
      <section className="mx-auto max-w-5xl">
        <header className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-sm font-medium text-blue-700">
                Campus Tag Editor
              </p>

              <h1 className="mt-2 text-3xl font-bold">
                タグ審査
              </h1>

              <p className="mt-3 leading-7 text-gray-600">
                Geminiが要確認と判断したタグを審査します。
              </p>
            </div>

            <nav className="flex flex-wrap gap-4 text-sm">
              <Link
                href="/search"
                className="underline"
              >
                学生検索
              </Link>

              <Link
                href="/profile/tags"
                className="underline"
              >
                タグ設定
              </Link>

              <Link
                href="/account"
                className="underline"
              >
                アカウント
              </Link>
            </nav>
          </div>

          <div className="mt-6 rounded-xl bg-blue-50 px-5 py-4 text-sm leading-6 text-blue-900">
            公開可能と判断したタグは承認し、問題の可能性が残るタグは理由を添えてAdminへ送ってください。
          </div>
        </header>

        {message ? (
          <div className="mt-6 rounded-xl bg-green-50 px-5 py-4 text-green-800">
            {message}
          </div>
        ) : null}

        {error ? (
          <div className="mt-6 rounded-xl bg-red-50 px-5 py-4 text-red-800">
            {error}
          </div>
        ) : null}

        {queueError ? (
          <div className="mt-6 rounded-xl border border-red-200 bg-white p-6 text-red-800">
            審査待ちタグを取得できませんでした。
          </div>
        ) : null}

        {!queueError ? (
          <section className="mt-8">
            <div className="flex items-end justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold">
                  審査待ち
                </h2>

                <p className="mt-2 text-gray-600">
                  古いものから順に表示しています。
                </p>
              </div>

              <p className="text-lg font-medium">
                {reviewQueue.length}件
              </p>
            </div>

            {reviewQueue.length === 0 ? (
              <div className="mt-5 rounded-2xl border border-gray-200 bg-white p-10 text-center shadow-sm">
                <p className="text-lg font-medium">
                  現在、審査待ちのタグはありません。
                </p>
              </div>
            ) : (
              <div className="mt-5 space-y-6">
                {reviewQueue.map((tag) => (
                  <article
                    key={tag.tag_id}
                    className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm"
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="text-sm text-gray-500">
                          {getSourceLabel(
                            tag.tag_source
                          )}
                        </p>

                        <h3 className="mt-2 break-words text-2xl font-bold">
                          {tag.tag_text}
                        </h3>
                      </div>

                      <span className="w-fit rounded-full bg-amber-100 px-3 py-1 text-sm font-medium text-amber-900">
                        {getReasonLabel(
                          tag.safety_reason_category
                        )}
                      </span>
                    </div>

                    <dl className="mt-6 grid gap-4 rounded-xl bg-gray-50 p-5">
                      <div>
                        <dt className="text-sm font-medium text-gray-500">
                          Geminiの判定理由
                        </dt>

                        <dd className="mt-1 leading-7">
                          {tag.safety_reason_summary ??
                            '理由は記録されていません。'}
                        </dd>
                      </div>

                      <div>
                        <dt className="text-sm font-medium text-gray-500">
                          安全確認日時
                        </dt>

                        <dd className="mt-1">
                          {formatDate(
                            tag.safety_checked_at
                          )}
                        </dd>
                      </div>
                    </dl>

                    <div className="mt-6 grid gap-6 lg:grid-cols-2">
                      <form
                        action={
                          approveEditorTagAction
                        }
                        className="rounded-xl border border-green-200 bg-green-50 p-5"
                      >
                        <input
                          type="hidden"
                          name="tag_id"
                          value={tag.tag_id}
                        />

                        <h4 className="font-bold text-green-950">
                          公開可能
                        </h4>

                        <p className="mt-2 text-sm leading-6 text-green-900">
                          Geminiの誤検知と判断し、このタグを公開可能にします。
                        </p>

                        <button
                          type="submit"
                          className="mt-4 rounded-lg bg-green-700 px-5 py-3 font-medium text-white"
                        >
                          公開可として承認
                        </button>
                      </form>

                      <form
                        action={
                          escalateEditorTagAction
                        }
                        className="rounded-xl border border-amber-200 bg-amber-50 p-5"
                      >
                        <input
                          type="hidden"
                          name="tag_id"
                          value={tag.tag_id}
                        />

                        <label
                          htmlFor={`comment-${tag.tag_id}`}
                          className="font-bold text-amber-950"
                        >
                          Adminへ送る
                        </label>

                        <p className="mt-2 text-sm leading-6 text-amber-900">
                          問題の可能性が残る理由を入力してください。
                        </p>

                        <textarea
                          id={`comment-${tag.tag_id}`}
                          name="editor_comment"
                          required
                          maxLength={1000}
                          rows={4}
                          className="mt-4 w-full rounded-lg border border-amber-300 bg-white px-4 py-3"
                          placeholder="例：個人情報に該当する可能性があるため、Adminによる確認をお願いします。"
                        />

                        <button
                          type="submit"
                          className="mt-4 rounded-lg bg-amber-700 px-5 py-3 font-medium text-white"
                        >
                          Adminの審査へ送る
                        </button>
                      </form>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        ) : null}
      </section>
    </main>
  )
}