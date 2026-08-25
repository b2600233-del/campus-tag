import Link from 'next/link'

import { loginAction } from '@/app/auth/actions'

type LoginPageProps = {
  searchParams: Promise<{
    error?: string
    message?: string
  }>
}

export default async function LoginPage({
  searchParams,
}: LoginPageProps) {
  const params = await searchParams

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-semibold text-gray-900">
          Campus Tag
        </h1>

        <h2 className="mt-2 text-lg font-medium text-gray-700">
          ログイン
        </h2>

        {params.error && (
          <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
            {params.error}
          </p>
        )}

        {params.message && (
          <p className="mt-4 rounded-lg bg-green-50 p-3 text-sm text-green-700">
            {params.message}
          </p>
        )}

        <form action={loginAction} className="mt-6 space-y-4">
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-gray-700"
            >
              Email
            </label>

            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-gray-700"
            >
              Password
            </label>

            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900"
            />
          </div>

          <button
            type="submit"
            className="w-full rounded-lg bg-gray-900 px-4 py-2 font-medium text-white"
          >
            ログイン
          </button>
        </form>

        <div className="mt-6 space-y-2 text-center text-sm">
          <p>
            <Link
              href="/forgot-password"
              className="text-gray-700 underline"
            >
              パスワードを忘れた場合
            </Link>
          </p>

          <p className="text-gray-600">
            アカウントがありませんか？{' '}
            <Link
              href="/signup"
              className="font-medium underline"
            >
              新規登録
            </Link>
          </p>
        </div>
      </div>
    </main>
  )
}