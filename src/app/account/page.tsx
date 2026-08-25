import { redirect } from 'next/navigation'

import { logoutAction } from '@/app/auth/actions'
import { createClient } from '@/lib/supabase/server'

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
      '/login?error=Campus Tagアカウント情報を取得できませんでした。'
    )
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-lg rounded-2xl bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-semibold text-gray-900">
          Campus Tag
        </h1>

        <p className="mt-2 text-green-700">
          認証に成功しています。
        </p>

        <dl className="mt-6 space-y-3 text-sm">
          <div>
            <dt className="font-medium text-gray-500">
              Email
            </dt>
            <dd className="text-gray-900">
              {user.email ?? '-'}
            </dd>
          </div>

          <div>
            <dt className="font-medium text-gray-500">
              Role
            </dt>
            <dd className="text-gray-900">
              {appUser.role}
            </dd>
          </div>

          <div>
            <dt className="font-medium text-gray-500">
              Account status
            </dt>
            <dd className="text-gray-900">
              {appUser.account_status}
            </dd>
          </div>

          <div>
            <dt className="font-medium text-gray-500">
              Account type
            </dt>
            <dd className="text-gray-900">
              {appUser.account_type}
            </dd>
          </div>
        </dl>

        <form action={logoutAction} className="mt-8">
          <button
            type="submit"
            className="w-full rounded-lg bg-gray-900 px-4 py-2 font-medium text-white"
          >
            ログアウト
          </button>
        </form>
      </div>
    </main>
  )
}