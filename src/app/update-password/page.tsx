'use client'

import {
  type FormEvent,
  useEffect,
  useState,
} from 'react'
import { useRouter } from 'next/navigation'

import { createClient } from '@/lib/supabase/client'

const MIN_PASSWORD_LENGTH = 8

export default function UpdatePasswordPage() {
  const router = useRouter()

  const [password, setPassword] = useState('')
  const [
    passwordConfirmation,
    setPasswordConfirmation,
  ] = useState('')

  const [recoveryReady, setRecoveryReady] =
    useState(false)

  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    let active = true

    async function checkRecoverySession() {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession()

      if (!active) {
        return
      }

      if (sessionError || !session) {
        setRecoveryReady(false)
        setError(
          '有効なパスワード再設定セッションを確認できません。最新の再設定メールのリンクからもう一度開いてください。'
        )
        return
      }

      setRecoveryReady(true)
      setError('')
    }

    void checkRecoverySession()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (!active) {
          return
        }

        if (session) {
          setRecoveryReady(true)
          setError('')
        }
      }
    )

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault()

    setError('')

    if (!recoveryReady) {
      setError(
        '有効なパスワード再設定セッションを確認できません。再設定メールのリンクから開いてください。'
      )
      return
    }

    if (
      !password ||
      !passwordConfirmation
    ) {
      setError(
        '新しいパスワードを入力してください。'
      )
      return
    }

    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(
        `パスワードは${MIN_PASSWORD_LENGTH}文字以上にしてください。`
      )
      return
    }

    if (password !== passwordConfirmation) {
      setError(
        '確認用パスワードが一致していません。'
      )
      return
    }

    setLoading(true)

    const supabase = createClient()

    const { error: updateError } =
      await supabase.auth.updateUser({
        password,
      })

    if (updateError) {
      setLoading(false)
      setError(
        `パスワードを更新できませんでした: ${updateError.message}`
      )
      return
    }

    await supabase.auth.signOut()

    const params = new URLSearchParams({
      message:
        'パスワードを更新しました。新しいパスワードでログインしてください。',
    })

    router.replace(`/login?${params.toString()}`)
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-semibold text-gray-900">
          新しいパスワード
        </h1>

        <p className="mt-2 text-sm text-gray-500">
          8文字以上の新しいパスワードを設定してください。
        </p>

        {!recoveryReady && !error && (
          <p className="mt-4 rounded-lg bg-gray-100 p-3 text-sm text-gray-700">
            パスワード再設定セッションを確認しています...
          </p>
        )}

        {error && (
          <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
            {error}
          </p>
        )}

        <form
          onSubmit={handleSubmit}
          className="mt-6 space-y-4"
        >
          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-gray-700"
            >
              New Password
            </label>

            <input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
              disabled={!recoveryReady}
              value={password}
              onChange={(event) =>
                setPassword(event.target.value)
              }
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 disabled:bg-gray-100"
            />
          </div>

          <div>
            <label
              htmlFor="passwordConfirmation"
              className="block text-sm font-medium text-gray-700"
            >
              Confirm Password
            </label>

            <input
              id="passwordConfirmation"
              name="passwordConfirmation"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
              disabled={!recoveryReady}
              value={passwordConfirmation}
              onChange={(event) =>
                setPasswordConfirmation(
                  event.target.value
                )
              }
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 disabled:bg-gray-100"
            />
          </div>

          <button
            type="submit"
            disabled={!recoveryReady || loading}
            className="w-full rounded-lg bg-gray-900 px-4 py-2 font-medium text-white disabled:opacity-50"
          >
            {loading
              ? '更新中...'
              : 'パスワードを更新'}
          </button>
        </form>
      </div>
    </main>
  )
}