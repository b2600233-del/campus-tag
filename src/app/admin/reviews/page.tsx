import Link from 'next/link'
import { redirect } from 'next/navigation'

import {
  approveAdminReviewAction,
  forcePrivateAdminReviewAction,
  removeAdminReviewAction,
  requestUserActionAdminReviewAction,
} from '@/app/admin/reviews/actions'
import { createClient } from '@/lib/supabase/server'

type AdminReviewsPageProps = {
  searchParams: Promise<{
    error?: string
    message?: string
  }>
}

type AdminReviewItem = {
  review_request_id: string
  profile_id: string | null
  target_user_id: string | null
  tag_id: string | null
  tag_exists: boolean
  current_tag_review_status: string | null
  target_email: string | null
  target_display_name: string | null
  target_tag_text: string | null
  target_tag_source: string | null
  target_field: string | null
  problematic_content: string | null
  reason_category: string
  editor_comment: string | null
  requested_by: string | null
  review_status: string
  resolution_action: string | null
  admin_comment: string | null
  user_message: string | null
  created_at: string
  updated_at: string
  closed_at: string | null
}

const REASON_LABELS: Record<string, string> = {
  personal_information: '個人情報',
  inappropriate_content: '不適切な内容',
  harassment_or_attack: '嫌がらせ・攻撃',
  unsafe_or_illegal: '危険・違法行為',
  other: 'その他',
}

const STATUS_LABELS: Record<string, string> = {
  pending_admin_review: 'Admin審査待ち',
  waiting_for_user: 'ユーザー対応待ち',
}

const SOURCE_LABELS: Record<string, string> = {
  user_added: 'ユーザー追加',
  ai_generated: 'AI生成',
}

function getLabel(
  labels: Record<string, string>,
  value: string | null
) {
  if (!value) {
    return '不明'
  }

  return labels[value] ?? value
}

function formatDate(value: string | null) {
  if (!value) {
    return '—'
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return '—'
  }

  return new Intl.DateTimeFormat('ja-JP', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Tokyo',
  }).format(date)
}

function AccessDeniedPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-16 text-slate-950">
      <section className="mx-auto max-w-3xl rounded-3xl border border-slate-200 bg-white p-8 shadow-sm sm:p-12">
        <p className="font-semibold text-red-700">
          アクセスできません
        </p>

        <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
          Admin権限が必要です
        </h1>

        <p className="mt-6 text-lg leading-8 text-slate-600">
          この画面は、Adminロールを持つ有効なアカウントだけが利用できます。
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/editor/tags"
            className="rounded-xl bg-slate-950 px-5 py-3 font-semibold text-white"
          >
            Editor審査へ
          </Link>

          <Link
            href="/search"
            className="rounded-xl border border-slate-300 px-5 py-3 font-semibold"
          >
            学生検索へ
          </Link>

          <Link
            href="/account"
            className="rounded-xl border border-slate-300 px-5 py-3 font-semibold"
          >
            アカウント
          </Link>
        </div>
      </section>
    </main>
  )
}

export default async function AdminReviewsPage({
  searchParams,
}: AdminReviewsPageProps) {
  const { error, message } = await searchParams

  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const {
    data: appUser,
    error: appUserError,
  } = await supabase
    .from('app_users')
    .select('role, account_status')
    .eq('id', user.id)
    .maybeSingle()

  if (appUserError) {
    console.error(
      'Admin account load failed:',
      appUserError
    )
  }

  if (
    !appUser ||
    appUser.role !== 'admin' ||
    appUser.account_status !== 'active'
  ) {
    return <AccessDeniedPage />
  }

  const {
    data: queueData,
    error: queueError,
  } = await supabase.rpc(
    'get_admin_review_queue',
    {
      p_limit: 100,
    }
  )

  if (queueError) {
    console.error(
      'Admin review queue load failed:',
      queueError
    )
  }

  const reviewQueue =
    (queueData ?? []) as unknown as AdminReviewItem[]

  const pendingCount = reviewQueue.filter(
    (item) =>
      item.review_status ===
      'pending_admin_review'
  ).length

  const waitingCount = reviewQueue.filter(
    (item) =>
      item.review_status ===
      'waiting_for_user'
  ).length

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10 text-slate-950 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm sm:p-10">
          <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="font-semibold text-red-700">
                Campus Tag Admin
              </p>

              <h1 className="mt-2 text-4xl font-bold tracking-tight sm:text-5xl">
                Admin審査
              </h1>

              <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-600">
                Editorから送られた審査依頼を確認し、タグの公開・削除・ユーザー対応・プロフィール強制非公開を判断します。
              </p>
            </div>

            <nav className="flex flex-wrap gap-x-6 gap-y-3 font-semibold">
                              <Link
                href="/admin/users"
                className="underline decoration-slate-300 underline-offset-4"
              >
                ユーザー管理
              </Link>
              <Link
                href="/editor/tags"
                className="underline decoration-slate-300 underline-offset-4"
              >
                Editor審査
              </Link>

              <Link
                href="/search"
                className="underline decoration-slate-300 underline-offset-4"
              >
                学生検索
              </Link>

              <Link
                href="/profile/tags"
                className="underline decoration-slate-300 underline-offset-4"
              >
                タグ設定
              </Link>

              <Link
                href="/account"
                className="underline decoration-slate-300 underline-offset-4"
              >
                アカウント
              </Link>
            </nav>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl bg-slate-100 p-5">
              <p className="text-sm font-semibold text-slate-600">
                未処理
              </p>
              <p className="mt-2 text-3xl font-bold">
                {pendingCount}件
              </p>
            </div>

            <div className="rounded-2xl bg-amber-50 p-5">
              <p className="text-sm font-semibold text-amber-800">
                ユーザー対応待ち
              </p>
              <p className="mt-2 text-3xl font-bold text-amber-950">
                {waitingCount}件
              </p>
            </div>

            <div className="rounded-2xl bg-blue-50 p-5">
              <p className="text-sm font-semibold text-blue-800">
                審査中合計
              </p>
              <p className="mt-2 text-3xl font-bold text-blue-950">
                {reviewQueue.length}件
              </p>
            </div>
          </div>
        </header>

        {message ? (
          <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 font-medium text-emerald-900">
            {message}
          </div>
        ) : null}

        {error ? (
          <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 font-medium text-red-900">
            {error}
          </div>
        ) : null}

        {queueError ? (
          <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-red-900">
            審査一覧を取得できませんでした。データベース関数とAdmin権限を確認してください。
          </div>
        ) : null}

        <section className="mt-10">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="text-3xl font-bold">
                審査依頼
              </h2>

              <p className="mt-2 text-slate-600">
                古い依頼から順に表示しています。
              </p>
            </div>

            <p className="text-2xl font-bold">
              {reviewQueue.length}件
            </p>
          </div>

          {!queueError &&
          reviewQueue.length === 0 ? (
            <div className="mt-6 rounded-3xl border border-slate-200 bg-white p-10 text-center text-lg font-semibold shadow-sm">
              現在、Admin審査待ちの依頼はありません。
            </div>
          ) : null}

          <div className="mt-6 space-y-8">
            {reviewQueue.map((item) => {
              const targetText =
                item.target_tag_text ??
                item.problematic_content ??
                '対象内容を取得できませんでした。'

              return (
                <article
                  key={item.review_request_id}
                  className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm"
                >
                  <div className="p-6 sm:p-8">
                    <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <div className="flex flex-wrap gap-2">
                          <span className="rounded-full bg-red-100 px-3 py-1 text-sm font-semibold text-red-900">
                            {getLabel(
                              REASON_LABELS,
                              item.reason_category
                            )}
                          </span>

                          <span className="rounded-full bg-amber-100 px-3 py-1 text-sm font-semibold text-amber-900">
                            {getLabel(
                              STATUS_LABELS,
                              item.review_status
                            )}
                          </span>

                          <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-700">
                            {getLabel(
                              SOURCE_LABELS,
                              item.target_tag_source
                            )}
                          </span>

                          {!item.tag_exists ? (
                            <span className="rounded-full bg-slate-900 px-3 py-1 text-sm font-semibold text-white">
                              タグ削除済み
                            </span>
                          ) : null}
                        </div>

                        <h3 className="mt-5 break-words text-2xl font-bold sm:text-3xl">
                          {targetText}
                        </h3>

                        <p className="mt-3 text-slate-600">
                          対象：
                          {item.target_display_name ??
                            '表示名不明'}
                          {' / '}
                          {item.target_email ??
                            'メールアドレス不明'}
                        </p>
                      </div>

                      <div className="shrink-0 rounded-2xl bg-slate-100 px-5 py-4 text-sm text-slate-700">
                        <p>
                          依頼日時：
                          {formatDate(item.created_at)}
                        </p>
                        <p className="mt-1">
                          更新日時：
                          {formatDate(item.updated_at)}
                        </p>
                      </div>
                    </div>

                    <div className="mt-7 grid gap-5 lg:grid-cols-2">
                      <div className="rounded-2xl bg-slate-50 p-5">
                        <p className="text-sm font-semibold text-slate-500">
                          Editorの判断理由
                        </p>

                        <p className="mt-2 whitespace-pre-wrap leading-7">
                          {item.editor_comment ??
                            'Editorコメントはありません。'}
                        </p>
                      </div>

                      <div className="rounded-2xl bg-slate-50 p-5">
                        <p className="text-sm font-semibold text-slate-500">
                          審査対象フィールド
                        </p>

                        <p className="mt-2">
                          {item.target_field ??
                            'プロフィールタグ'}
                        </p>

                        <p className="mt-4 text-sm font-semibold text-slate-500">
                          現在のタグ状態
                        </p>

                        <p className="mt-2">
                          {item.current_tag_review_status ??
                            'タグが存在しません'}
                        </p>
                      </div>
                    </div>

                    {item.review_status ===
                    'waiting_for_user' ? (
                      <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-5">
                        <p className="font-semibold text-amber-950">
                          現在のユーザー向けメッセージ
                        </p>

                        <p className="mt-2 whitespace-pre-wrap leading-7 text-amber-900">
                          {item.user_message ??
                            'メッセージはありません。'}
                        </p>
                      </div>
                    ) : null}
                  </div>

                  <div className="border-t border-slate-200 bg-slate-50 p-6 sm:p-8">
                    <h4 className="text-xl font-bold">
                      Adminの判断
                    </h4>

                    <div className="mt-5 grid gap-5 xl:grid-cols-2">
                      <details className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
                        <summary className="cursor-pointer font-bold text-emerald-950">
                          公開可能として承認
                        </summary>

                        <p className="mt-3 text-sm leading-6 text-emerald-900">
                          問題がないと判断し、タグを公開可能にします。
                        </p>

                        <form
                          action={approveAdminReviewAction}
                          className="mt-4 space-y-4"
                        >
                          <input
                            type="hidden"
                            name="review_request_id"
                            value={
                              item.review_request_id
                            }
                          />

                          <textarea
                            name="admin_comment"
                            rows={3}
                            maxLength={2000}
                            placeholder="Adminコメント（任意）"
                            className="w-full rounded-xl border border-emerald-200 bg-white p-3"
                          />

                          <textarea
                            name="user_message"
                            rows={3}
                            maxLength={2000}
                            placeholder="ユーザー向けメッセージ（任意）"
                            className="w-full rounded-xl border border-emerald-200 bg-white p-3"
                          />

                          <button
                            type="submit"
                            disabled={!item.tag_exists}
                            className="rounded-xl bg-emerald-700 px-5 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            公開を承認
                          </button>
                        </form>
                      </details>

                      <details className="rounded-2xl border border-orange-200 bg-orange-50 p-5">
                        <summary className="cursor-pointer font-bold text-orange-950">
                          タグを削除
                        </summary>

                        <p className="mt-3 text-sm leading-6 text-orange-900">
                          問題のあるタグを削除し、審査を解決します。
                        </p>

                        <form
                          action={removeAdminReviewAction}
                          className="mt-4 space-y-4"
                        >
                          <input
                            type="hidden"
                            name="review_request_id"
                            value={
                              item.review_request_id
                            }
                          />

                          <textarea
                            name="admin_comment"
                            rows={3}
                            maxLength={2000}
                            required
                            placeholder="判断理由（必須）"
                            className="w-full rounded-xl border border-orange-200 bg-white p-3"
                          />

                          <textarea
                            name="user_message"
                            rows={3}
                            maxLength={2000}
                            required
                            placeholder="ユーザー向けメッセージ（必須）"
                            className="w-full rounded-xl border border-orange-200 bg-white p-3"
                          />

                          <button
                            type="submit"
                            className="rounded-xl bg-orange-700 px-5 py-3 font-semibold text-white"
                          >
                            タグを削除
                          </button>
                        </form>
                      </details>

                      <details className="rounded-2xl border border-blue-200 bg-blue-50 p-5">
                        <summary className="cursor-pointer font-bold text-blue-950">
                          ユーザーへ対応を依頼
                        </summary>

                        <p className="mt-3 text-sm leading-6 text-blue-900">
                          タグは非公開のまま、ユーザー対応待ちに変更します。
                        </p>

                        <form
                          action={
                            requestUserActionAdminReviewAction
                          }
                          className="mt-4 space-y-4"
                        >
                          <input
                            type="hidden"
                            name="review_request_id"
                            value={
                              item.review_request_id
                            }
                          />

                          <textarea
                            name="admin_comment"
                            rows={3}
                            maxLength={2000}
                            required
                            placeholder="Admin内部の判断理由（必須）"
                            className="w-full rounded-xl border border-blue-200 bg-white p-3"
                          />

                          <textarea
                            name="user_message"
                            rows={3}
                            maxLength={2000}
                            required
                            placeholder="ユーザーに伝える内容（必須）"
                            className="w-full rounded-xl border border-blue-200 bg-white p-3"
                          />

                          <button
                            type="submit"
                            className="rounded-xl bg-blue-700 px-5 py-3 font-semibold text-white"
                          >
                            対応を依頼
                          </button>
                        </form>
                      </details>

                      <details className="rounded-2xl border border-red-300 bg-red-50 p-5">
                        <summary className="cursor-pointer font-bold text-red-950">
                          プロフィールを強制非公開
                        </summary>

                        <p className="mt-3 text-sm leading-6 text-red-900">
                          重大な問題としてプロフィール全体を強制非公開にし、対象タグを削除します。
                        </p>

                        <form
                          action={
                            forcePrivateAdminReviewAction
                          }
                          className="mt-4 space-y-4"
                        >
                          <input
                            type="hidden"
                            name="review_request_id"
                            value={
                              item.review_request_id
                            }
                          />

                          <textarea
                            name="admin_comment"
                            rows={3}
                            maxLength={2000}
                            required
                            placeholder="強制非公開の理由（必須）"
                            className="w-full rounded-xl border border-red-300 bg-white p-3"
                          />

                          <textarea
                            name="user_message"
                            rows={3}
                            maxLength={2000}
                            required
                            placeholder="ユーザー向けメッセージ（必須）"
                            className="w-full rounded-xl border border-red-300 bg-white p-3"
                          />

                          <button
                            type="submit"
                            disabled={!item.profile_id}
                            className="rounded-xl bg-red-700 px-5 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            強制非公開にする
                          </button>
                        </form>
                      </details>
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        </section>
      </div>
    </main>
  )
}