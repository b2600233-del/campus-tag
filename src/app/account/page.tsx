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
    .select('role, account_status, account_type')
    .eq('id', user.id)
    .single()

  if (!appUser || appUser.account_status !== 'active') {
    redirect(
      `/login?error=${encodeURIComponent(
        'Campus Tagアカウントを利用できません。',
      )}`,
    )
  }

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

            <Link
              href="/search"
              className="inline-flex justify-center rounded-xl bg-slate-950 px-5 py-3 font-semibold text-white transition hover:bg-slate-800"
            >
              学生検索を開く
            </Link>
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
        </section>

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