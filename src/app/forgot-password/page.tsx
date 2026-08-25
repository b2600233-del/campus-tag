'use client'

import Link from 'next/link'
import { type FormEvent, useState } from 'react'

import { createClient } from '@/lib/supabase/client'

const AIU_STUDENT_DOMAIN = 'gl.aiu.ac.jp'

function isAiuStudentEmail(email: string) {
  const parts = email.toLowerCase().split('@')

  return (
    parts.length === 2 &&
    parts[0].length > 0 &&
    parts[1] === AIU_STUDENT_DOMAIN
  )
}

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault()

    setError('')
    setMessage('')

    const normalizedEmail = email.trim().toLowerCase()

    if (!normalizedEmail) {
      setError('メールアドレスを入力してください。')
      return
    }

    /*
     * Student self-service password reset only.
     * Demo accounts use non-AIU email addresses and are
     * managed by the system owner.
     */
    if (!isAiuStudentEmail(normalizedEmail)) {
      setError(
        '学生用パスワード再設定はAIU学生メールのみ利用できます。'
      )
      return
    }

    setLoading(true)

    const supabase = createClient()

    const { error: resetError } =
      await supabase.auth.resetPasswordForEmail(
        normalizedEmail,
        {
          redirectTo: `${window.location.origin}/auth/callback?next=/update-password`,
        }
      )

    setLoading(false)

    if (resetError) {
      setError(
        `再設定メールを送信できませんでした: ${resetError.message}`
      )
      return
    }

    setMessage(
      '対象のアカウントが存在する場合、パスワード再設定メールが送信されます。'
    )
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-semibold text-gray-900">
          パスワード再設定
        </h1>

        <p className="mt-2 text-sm text-gray-500">
          AIU学生メールへ再設定リンクを送信します。
        </p>

        {error && (
          <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
            {error}
          </p>
        )}

        {message && (
          <p className="mt-4 rounded-lg bg-green-50 p-3 text-sm text-green-700">
            {message}
          </p>
        )}

        <form
          onSubmit={handleSubmit}
          className="mt-6 space-y-4"
        >
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-gray-700"
            >
              AIU Email
            </label>

            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) =>
                setEmail(event.target.value)
              }
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900"
              placeholder="example@gl.aiu.ac.jp"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-gray-900 px-4 py-2 font-medium text-white disabled:opacity-50"
          >
            {loading
              ? '送信中...'
              : '再設定メールを送る'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm">
          <Link href="/login" className="underline">
            ログインへ戻る
          </Link>
        </p>
      </div>
    </main>
  )
}