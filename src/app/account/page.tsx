import Link from 'next/link'
import { redirect } from 'next/navigation'

import { logoutAction } from '@/app/auth/actions'
import { createClient } from '@/lib/supabase/server'

const roleLabels: Record<string, string> = {
  viewer: 'Viewer',
  editor: 'Editor',
  admin: 'Admin',
}

const accountStatusLabels: Record<string, string> = {
  active: '有効',
  suspended: '停止中',
}

const accountTypeLabels: Record<string, string> = {
  student: '学生',
}

const revisionStatusLabels: Record<string, string> = {
  pending_admin_review: 'Admin確認中',
  waiting_for_user: 'あなたの対応待ち',
  resolved: '対応済み',
  dismissed: '対応不要',
}

type RevisionRequest = {
  request_id: string
  status: string
  user_message: string | null
  target_field: string | null
  target_tag_snapshot: string | null
  problematic_content_snapshot: string | null
  created_at: string
  updated_at: string
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('ja-JP', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Tokyo',
  }).format(new Date(value))
}

export default async function AccountPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: appUser } = await supabase
    .from('app_users')
    .select(
      'role, account_status, account_type, current_suspension_reason, suspended_at',
    )
    .eq('id', user.id)
    .single()

  if (!appUser) {
    redirect(
      `/login?error=${encodeURIComponent(
        'Campus Tagアカウントを利用できません。',
      )}`,
    )
  }

  const {
    data: revisionRequestsData,
    error: revisionRequestsError,
  } = await supabase.rpc('get_my_revision_requests')

  const revisionRequests =
    (revisionRequestsData ?? []) as RevisionRequest[]

  const isSuspended = appUser.account_status === 'suspended'

  const isEditor =
    appUser.role === 'editor' || appUser.role === 'admin'
  const isAdmin = appUser.role === 'admin'

  const navigationItems = [
    {
      href: '/search',
      title: '学生検索',
      description: 'タグや言語などから学生プロフィールを検索します。',
    },
    {
      href: '/profile/edit',
      title: '基本プロフィール',
      description: '表示名などの基本情報を編集します。',
    },
    {
      href: '/profile/languages',
      title: '言語設定',
      description: '学習中・使用可能な言語を設定します。',
    },
    {
      href: '/profile/tags',
      title: 'タグ設定',
      description: '興味・経験・スキルを表すタグを管理します。',
    },
    {
      href: '/profile/publication',
      title: '公開設定',
      description: 'プロフィールの公開・非公開を切り替えます。',
    },
  ]

  if (isEditor) {
    navigationItems.push({
      href: '/editor/tags',
      title: 'Editor審査',
      description: '要確認タグを審査し、公開可否を判断します。',
    })
  }

  if (isAdmin) {
    navigationItems.push(
      {
        href: '/admin/reviews',
        title: 'Admin審査',
        description: 'Editorから送られた審査依頼を処理します。',
      },
      {
        href: '/admin/users',
        title: 'ユーザー管理',
        description: 'ロール、利用状態、公開制限を管理します。',
      },
    )
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-5xl">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-10">
          <p className="font-semibold text-red-700">
            Campus Tag
          </p>

          <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
                アカウント
              </h1>
              <p className="mt-3 text-slate-600">
                認証に成功しています。利用する機能を選択してください。
              </p>
            </div>

            {!isSuspended && (
              <Link
                href="/search"
                className="inline-flex justify-center rounded-xl bg-slate-950 px-5 py-3 font-semibold text-white transition hover:bg-slate-800"
              >
                学生検索を開く
              </Link>
            )}
          </div>

          <dl className="mt-8 grid gap-4 rounded-2xl bg-slate-100 p-5 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <dt className="font-semibold text-slate-500">
                メールアドレス
              </dt>
              <dd className="mt-1 break-all text-slate-950">
                {user.email ?? '未設定'}
              </dd>
            </div>

            <div>
              <dt className="font-semibold text-slate-500">
                ロール
              </dt>
              <dd className="mt-1 text-slate-950">
                {roleLabels[appUser.role] ?? appUser.role}
              </dd>
            </div>

            <div>
              <dt className="font-semibold text-slate-500">
                アカウント状態
              </dt>
              <dd className="mt-1 text-slate-950">
                {accountStatusLabels[appUser.account_status] ??
                  appUser.account_status}
              </dd>
            </div>

            <div>
              <dt className="font-semibold text-slate-500">
                アカウント種別
              </dt>
              <dd className="mt-1 text-slate-950">
                {accountTypeLabels[appUser.account_type] ??
                  appUser.account_type}
              </dd>
            </div>
          </dl>

          {isSuspended && (
            <div className="mt-6 rounded-2xl border border-amber-300 bg-amber-50 p-5 text-amber-950">
              <h2 className="text-lg font-bold">
                アカウントは現在停止中です
              </h2>
              <p className="mt-2 leading-7">
                通常機能は利用できません。停止理由と修正依頼を確認してください。
              </p>
              <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <dt className="font-semibold">停止理由</dt>
                  <dd className="mt-1">
                    {appUser.current_suspension_reason ??
                      '停止理由は登録されていません。'}
                  </dd>
                </div>
                <div>
                  <dt className="font-semibold">停止日時</dt>
                  <dd className="mt-1">
                    {appUser.suspended_at
                      ? formatDate(appUser.suspended_at)
                      : '未記録'}
                  </dd>
                </div>
              </dl>
            </div>
          )}
        </section>

        {!isSuspended && (
          <section className="mt-8">
            <h2 className="text-2xl font-bold text-slate-950">
              メニュー
            </h2>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {navigationItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-400 hover:shadow-md"
                >
                  <h3 className="text-lg font-bold text-slate-950">
                    {item.title}
                  </h3>
                  <p className="mt-2 leading-7 text-slate-600">
                    {item.description}
                  </p>
                </Link>
              ))}
            </div>
          </section>
        )}

        <section className="mt-8">
          <h2 className="text-2xl font-bold text-slate-950">
            自分宛ての修正依頼
          </h2>

          {revisionRequestsError ? (
            <p className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-5 text-red-800">
              修正依頼を読み込めませんでした。
            </p>
          ) : (revisionRequests ?? []).length > 0 ? (
            <div className="mt-4 space-y-4">
              {(revisionRequests ?? []).map((request) => (
                <article
                  key={request.request_id}
                  className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <span className="rounded-full bg-amber-100 px-3 py-1 text-sm font-semibold text-amber-900">
                      {revisionStatusLabels[request.status] ??
                        request.status}
                    </span>
                    <time className="text-sm text-slate-500">
                      更新: {formatDate(request.updated_at)}
                    </time>
                  </div>

                  <p className="mt-4 whitespace-pre-wrap font-medium leading-7 text-slate-950">
                    {request.user_message}
                  </p>

                  {(request.target_tag_snapshot ||
                    request.target_field ||
                    request.problematic_content_snapshot) && (
                    <dl className="mt-4 rounded-xl bg-slate-100 p-4 text-sm text-slate-700">
                      {request.target_tag_snapshot && (
                        <div>
                          <dt className="font-semibold">対象タグ</dt>
                          <dd className="mt-1">
                            {request.target_tag_snapshot}
                          </dd>
                        </div>
                      )}
                      {request.target_field && (
                        <div className="mt-3 first:mt-0">
                          <dt className="font-semibold">対象項目</dt>
                          <dd className="mt-1">
                            {request.target_field}
                          </dd>
                        </div>
                      )}
                      {request.problematic_content_snapshot && (
                        <div className="mt-3 first:mt-0">
                          <dt className="font-semibold">確認対象</dt>
                          <dd className="mt-1 break-words">
                            {request.problematic_content_snapshot}
                          </dd>
                        </div>
                      )}
                    </dl>
                  )}
                </article>
              ))}
            </div>
          ) : (
            <p className="mt-4 rounded-2xl border border-slate-200 bg-white p-5 text-slate-600">
              現在、自分宛ての修正依頼はありません。
            </p>
          )}
        </section>

        <form action={logoutAction} className="mt-8">
          <button
            type="submit"
            className="w-full rounded-xl border border-red-200 bg-white px-5 py-3 font-semibold text-red-700 transition hover:bg-red-50"
          >
            ログアウト
          </button>
        </form>
      </div>
    </main>
  )
}
