import Link from 'next/link'
import { redirect } from 'next/navigation'

import {
  changeAdminUserRoleAction,
  forcePrivateAdminUserAction,
  reactivateAdminUserAction,
  releaseForcedPrivateAdminUserAction,
  suspendAdminUserAction,
} from '@/app/admin/users/actions'
import { createClient } from '@/lib/supabase/server'

type SearchParamValue = string | string[] | undefined

type AdminUsersPageProps = {
  searchParams: Promise<Record<string, SearchParamValue>>
}

type AdminUserDirectoryRow = {
  user_id: string
  email: string | null
  student_number: string | null
  role: string
  account_status: string
  account_type: string
  display_name: string | null
  profile_is_public: boolean | null
  profile_is_forced_private: boolean | null
  current_suspension_reason: string | null
  suspended_at: string | null
  suspended_by_user_id: string | null
  created_at: string
  updated_at: string
  total_count: number | string
}

const roleLabels: Record<string, string> = {
  viewer: 'Viewer',
  editor: 'Editor',
  admin: 'Admin',
}

const accountTypeLabels: Record<string, string> = {
  student: '学生',
  demo: 'デモ',
}

function getFirstParam(value: SearchParamValue) {
  if (Array.isArray(value)) {
    return value[0] ?? ''
  }

  return value ?? ''
}

function formatDate(value: string | null) {
  if (!value) {
    return '―'
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return '―'
  }

  return new Intl.DateTimeFormat('ja-JP', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Tokyo',
  }).format(date)
}

function getRoleBadgeClass(role: string) {
  if (role === 'admin') {
    return 'bg-red-100 text-red-800'
  }

  if (role === 'editor') {
    return 'bg-blue-100 text-blue-800'
  }

  return 'bg-slate-100 text-slate-700'
}

function getAccountBadgeClass(status: string) {
  if (status === 'suspended') {
    return 'bg-amber-100 text-amber-800'
  }

  return 'bg-emerald-100 text-emerald-800'
}

function getProfileStatus(row: AdminUserDirectoryRow) {
  if (row.profile_is_public === null) {
    return 'プロフィール未作成'
  }

  if (row.profile_is_forced_private) {
    return '強制非公開'
  }

  if (row.profile_is_public) {
    return '公開中'
  }

  return '非公開'
}

export default async function AdminUsersPage({
  searchParams,
}: AdminUsersPageProps) {
  const params = await searchParams
  const query = getFirstParam(params.q).trim().slice(0, 100)
  const message = getFirstParam(params.message)
  const errorMessage = getFirstParam(params.error)

  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    redirect('/login')
  }

  const {
    data: currentAppUser,
    error: currentAppUserError,
  } = await supabase
    .from('app_users')
    .select('role, account_status')
    .eq('id', user.id)
    .maybeSingle()

  const hasAdminAccess =
    !currentAppUserError &&
    currentAppUser?.role === 'admin' &&
    currentAppUser.account_status === 'active'

  if (!hasAdminAccess) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-16 sm:px-6">
        <section className="mx-auto max-w-4xl rounded-3xl border border-slate-200 bg-white p-8 shadow-sm sm:p-12">
          <p className="font-semibold text-red-700">
            アクセスできません
          </p>

          <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-950 sm:text-5xl">
            Admin権限が必要です
          </h1>

          <p className="mt-6 text-lg leading-8 text-slate-600">
            この画面は、Adminロールを持つ有効なアカウントだけが利用できます。
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/admin/reviews"
              className="rounded-xl bg-slate-950 px-5 py-3 font-semibold text-white"
            >
              Admin審査へ
            </Link>

            <Link
              href="/search"
              className="rounded-xl border border-slate-300 px-5 py-3 font-semibold text-slate-950"
            >
              学生検索へ
            </Link>

            <Link
              href="/account"
              className="rounded-xl border border-slate-300 px-5 py-3 font-semibold text-slate-950"
            >
              アカウント
            </Link>
          </div>
        </section>
      </main>
    )
  }

  const {
    data: directoryData,
    error: directoryError,
  } = await supabase.rpc('get_admin_user_directory', {
    p_search: query || null,
    p_limit: 100,
    p_offset: 0,
  })

  const directory =
    (directoryData ?? []) as AdminUserDirectoryRow[]

  const totalCount = Number(directory[0]?.total_count ?? 0)

  const activeCount = directory.filter(
    (entry) => entry.account_status === 'active',
  ).length

  const suspendedCount = directory.filter(
    (entry) => entry.account_status === 'suspended',
  ).length

  const adminCount = directory.filter(
    (entry) =>
      entry.role === 'admin' &&
      entry.account_status === 'active',
  ).length

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-8">
        <header className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm sm:p-10">
          <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="font-semibold text-red-700">
                Campus Tag Admin
              </p>

              <h1 className="mt-2 text-4xl font-bold tracking-tight text-slate-950 sm:text-6xl">
                ユーザー管理
              </h1>

              <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-600">
                ユーザーのロール、アカウント状態、プロフィールの公開制限を管理します。
              </p>
            </div>

            <nav className="flex flex-wrap gap-x-6 gap-y-3 font-semibold text-slate-950">
              <Link
                href="/admin/reviews"
                className="border-b border-slate-300"
              >
                Admin審査
              </Link>

              <Link
                href="/editor/tags"
                className="border-b border-slate-300"
              >
                Editor審査
              </Link>

              <Link
                href="/search"
                className="border-b border-slate-300"
              >
                学生検索
              </Link>

              <Link
                href="/profile/tags"
                className="border-b border-slate-300"
              >
                タグ設定
              </Link>

              <Link
                href="/account"
                className="border-b border-slate-300"
              >
                アカウント
              </Link>
            </nav>
          </div>

          <div className="mt-10 grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl bg-emerald-50 p-5">
              <p className="font-semibold text-emerald-800">
                表示中の有効アカウント
              </p>

              <p className="mt-2 text-4xl font-bold text-emerald-950">
                {activeCount}件
              </p>
            </div>

            <div className="rounded-2xl bg-amber-50 p-5">
              <p className="font-semibold text-amber-800">
                表示中の停止アカウント
              </p>

              <p className="mt-2 text-4xl font-bold text-amber-950">
                {suspendedCount}件
              </p>
            </div>

            <div className="rounded-2xl bg-red-50 p-5">
              <p className="font-semibold text-red-800">
                表示中の有効なAdmin
              </p>

              <p className="mt-2 text-4xl font-bold text-red-950">
                {adminCount}件
              </p>
            </div>
          </div>
        </header>

        {message ? (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-6 py-5 text-emerald-900">
            {message}
          </div>
        ) : null}

        {errorMessage ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-6 py-5 text-red-900">
            {errorMessage}
          </div>
        ) : null}

        {directoryError ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-6 py-5 text-red-900">
            ユーザー一覧を取得できませんでした。Supabaseのユーザー管理関数と権限設定を確認してください。
          </div>
        ) : null}

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="text-3xl font-bold text-slate-950">
                ユーザー検索
              </h2>

              <p className="mt-2 text-slate-600">
                メールアドレス、学籍番号、表示名から検索できます。
              </p>
            </div>

            <p className="font-semibold text-slate-700">
              該当 {totalCount}件
            </p>
          </div>

          <form
            method="get"
            className="mt-6 flex flex-col gap-3 sm:flex-row"
          >
            <label className="flex-1">
              <span className="sr-only">
                ユーザー検索
              </span>

              <input
                type="search"
                name="q"
                defaultValue={query}
                maxLength={100}
                placeholder="メールアドレス・学籍番号・表示名"
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-950 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
              />
            </label>

            <button
              type="submit"
              className="rounded-xl bg-slate-950 px-6 py-3 font-semibold text-white"
            >
              検索
            </button>

            {query ? (
              <Link
                href="/admin/users"
                className="rounded-xl border border-slate-300 px-6 py-3 text-center font-semibold text-slate-950"
              >
                解除
              </Link>
            ) : null}
          </form>

          <p className="mt-3 text-sm text-slate-500">
            一度に最大100件まで表示します。
          </p>
        </section>

        <section>
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 className="text-3xl font-bold text-slate-950">
                ユーザー一覧
              </h2>

              <p className="mt-2 text-slate-600">
                変更内容は、各ユーザーの操作欄から送信してください。
              </p>
            </div>

            <p className="text-xl font-bold text-slate-950">
              {directory.length}件表示
            </p>
          </div>

          {!directoryError && directory.length === 0 ? (
            <div className="mt-6 rounded-3xl border border-slate-200 bg-white p-10 text-center shadow-sm">
              <p className="text-lg font-semibold text-slate-700">
                条件に一致するユーザーはいません。
              </p>
            </div>
          ) : null}

          <div className="mt-6 space-y-6">
            {directory.map((entry) => {
              const isCurrentUser = entry.user_id === user.id
              const hasProfile =
                entry.profile_is_public !== null
              const profileStatus = getProfileStatus(entry)

              return (
                <article
                  key={entry.user_id}
                  className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8"
                >
                  <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
                    <div>
                      <div className="flex flex-wrap gap-2">
                        <span
                          className={`rounded-full px-3 py-1 text-sm font-semibold ${getRoleBadgeClass(entry.role)}`}
                        >
                          {roleLabels[entry.role] ?? entry.role}
                        </span>

                        <span
                          className={`rounded-full px-3 py-1 text-sm font-semibold ${getAccountBadgeClass(entry.account_status)}`}
                        >
                          {entry.account_status === 'active'
                            ? '有効'
                            : '停止中'}
                        </span>

                        <span className="rounded-full bg-violet-100 px-3 py-1 text-sm font-semibold text-violet-800">
                          {profileStatus}
                        </span>

                        {isCurrentUser ? (
                          <span className="rounded-full bg-slate-950 px-3 py-1 text-sm font-semibold text-white">
                            自分のアカウント
                          </span>
                        ) : null}
                      </div>

                      <h3 className="mt-4 break-words text-2xl font-bold text-slate-950 sm:text-3xl">
                        {entry.display_name || '表示名未設定'}
                      </h3>

                      <p className="mt-2 break-all text-lg text-slate-700">
                        {entry.email || 'メールアドレス不明'}
                      </p>

                      <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-600">
                        <p>
                          学籍番号：
                          {entry.student_number || '未設定'}
                        </p>

                        <p>
                          アカウント種別：
                          {accountTypeLabels[entry.account_type] ??
                            entry.account_type}
                        </p>

                        <p>
                          登録日時：
                          {formatDate(entry.created_at)}
                        </p>

                        <p>
                          更新日時：
                          {formatDate(entry.updated_at)}
                        </p>
                      </div>
                    </div>

                    <div className="rounded-2xl bg-slate-100 px-5 py-4 text-sm leading-7 text-slate-700">
                      <p className="font-semibold text-slate-950">
                        プロフィール状態
                      </p>

                      <p>
                        通常公開：
                        {entry.profile_is_public ? 'はい' : 'いいえ'}
                      </p>

                      <p>
                        強制非公開：
                        {entry.profile_is_forced_private
                          ? 'はい'
                          : 'いいえ'}
                      </p>
                    </div>
                  </div>

                  {entry.account_status === 'suspended' ? (
                    <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-950">
                      <p className="font-semibold">
                        アカウント停止情報
                      </p>

                      <p className="mt-2 whitespace-pre-wrap">
                        {entry.current_suspension_reason ||
                          '停止理由なし'}
                      </p>

                      <p className="mt-2 text-sm">
                        停止日時：
                        {formatDate(entry.suspended_at)}
                      </p>
                    </div>
                  ) : null}

                  <div className="mt-8 grid gap-5 lg:grid-cols-3">
                    <section className="rounded-2xl border border-blue-200 bg-blue-50 p-5">
                      <h4 className="text-lg font-bold text-blue-950">
                        ロール管理
                      </h4>

                      <p className="mt-2 text-sm leading-6 text-blue-900">
                        Viewer、Editor、Adminの権限を切り替えます。
                      </p>

                      {isCurrentUser ? (
                        <p className="mt-5 rounded-xl bg-white/80 p-4 text-sm font-semibold text-blue-950">
                          自分自身のAdmin権限は、この画面から変更できません。
                        </p>
                      ) : (
                        <form
                          action={changeAdminUserRoleAction}
                          className="mt-5 space-y-3"
                        >
                          <input
                            type="hidden"
                            name="target_user_id"
                            value={entry.user_id}
                          />

                          <input
                            type="hidden"
                            name="return_search"
                            value={query}
                          />

                          <label className="block">
                            <span className="text-sm font-semibold text-blue-950">
                              新しいロール
                            </span>

                            <select
                              name="new_role"
                              defaultValue={entry.role}
                              className="mt-2 w-full rounded-xl border border-blue-300 bg-white px-4 py-3 text-slate-950"
                            >
                              <option value="viewer">
                                Viewer
                              </option>

                              <option value="editor">
                                Editor
                              </option>

                              <option value="admin">
                                Admin
                              </option>
                            </select>
                          </label>

                          <button
                            type="submit"
                            className="rounded-xl bg-blue-700 px-5 py-3 font-semibold text-white"
                          >
                            ロールを変更
                          </button>
                        </form>
                      )}
                    </section>

                    <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
                      <h4 className="text-lg font-bold text-amber-950">
                        アカウント管理
                      </h4>

                      {isCurrentUser ? (
                        <p className="mt-5 rounded-xl bg-white/80 p-4 text-sm font-semibold text-amber-950">
                          自分自身のアカウントは停止できません。
                        </p>
                      ) : entry.account_status === 'suspended' ? (
                        <form
                          action={reactivateAdminUserAction}
                          className="mt-5"
                        >
                          <input
                            type="hidden"
                            name="target_user_id"
                            value={entry.user_id}
                          />

                          <input
                            type="hidden"
                            name="return_search"
                            value={query}
                          />

                          <p className="mb-4 text-sm leading-6 text-amber-900">
                            停止理由を解除し、アカウントを有効な状態へ戻します。
                          </p>

                          <button
                            type="submit"
                            className="rounded-xl bg-emerald-700 px-5 py-3 font-semibold text-white"
                          >
                            アカウントを再開
                          </button>
                        </form>
                      ) : (
                        <form
                          action={suspendAdminUserAction}
                          className="mt-5 space-y-3"
                        >
                          <input
                            type="hidden"
                            name="target_user_id"
                            value={entry.user_id}
                          />

                          <input
                            type="hidden"
                            name="return_search"
                            value={query}
                          />

                          <label className="block">
                            <span className="text-sm font-semibold text-amber-950">
                              停止理由
                            </span>

                            <textarea
                              name="reason"
                              required
                              maxLength={1000}
                              rows={4}
                              placeholder="例：利用規約違反を確認したため"
                              className="mt-2 w-full rounded-xl border border-amber-300 bg-white px-4 py-3 text-slate-950"
                            />
                          </label>

                          <button
                            type="submit"
                            className="rounded-xl bg-amber-700 px-5 py-3 font-semibold text-white"
                          >
                            アカウントを停止
                          </button>
                        </form>
                      )}
                    </section>

                    <section className="rounded-2xl border border-violet-200 bg-violet-50 p-5">
                      <h4 className="text-lg font-bold text-violet-950">
                        公開制限
                      </h4>

                      {!hasProfile ? (
                        <p className="mt-5 rounded-xl bg-white/80 p-4 text-sm font-semibold text-violet-950">
                          このユーザーはまだプロフィールを作成していません。
                        </p>
                      ) : entry.profile_is_forced_private ? (
                        <form
                          action={releaseForcedPrivateAdminUserAction}
                          className="mt-5"
                        >
                          <input
                            type="hidden"
                            name="target_user_id"
                            value={entry.user_id}
                          />

                          <input
                            type="hidden"
                            name="return_search"
                            value={query}
                          />

                          <p className="mb-4 text-sm leading-6 text-violet-900">
                            強制非公開を解除します。解除後も自動では公開されず、本人による再公開が必要です。
                          </p>

                          <button
                            type="submit"
                            className="rounded-xl bg-emerald-700 px-5 py-3 font-semibold text-white"
                          >
                            強制非公開を解除
                          </button>
                        </form>
                      ) : (
                        <form
                          action={forcePrivateAdminUserAction}
                          className="mt-5"
                        >
                          <input
                            type="hidden"
                            name="target_user_id"
                            value={entry.user_id}
                          />

                          <input
                            type="hidden"
                            name="return_search"
                            value={query}
                          />

                          <p className="mb-4 text-sm leading-6 text-violet-900">
                            プロフィールを非公開にし、本人による再公開も禁止します。
                          </p>

                          <button
                            type="submit"
                            className="rounded-xl bg-violet-700 px-5 py-3 font-semibold text-white"
                          >
                            強制非公開にする
                          </button>
                        </form>
                      )}
                    </section>
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