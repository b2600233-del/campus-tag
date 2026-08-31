'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { createClient } from '@/lib/supabase/server'

type RedirectKey = 'error' | 'message'

type RpcError = {
  code?: string
  message?: string
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function getFormValue(
  formData: FormData,
  key: string
) {
  const value = formData.get(key)

  return typeof value === 'string'
    ? value.trim()
    : ''
}

function redirectFromAdminReviews(
  key: RedirectKey,
  message: string
): never {
  const params = new URLSearchParams({
    [key]: message,
  })

  redirect(
    `/admin/reviews?${params.toString()}`
  )
}

function getReviewRequestId(
  formData: FormData
) {
  const reviewRequestId = getFormValue(
    formData,
    'review_request_id'
  )

  if (!UUID_PATTERN.test(reviewRequestId)) {
    redirectFromAdminReviews(
      'error',
      '審査依頼を確認できませんでした。'
    )
  }

  return reviewRequestId
}

function getOptionalText(
  formData: FormData,
  key: string,
  label: string
) {
  const value = getFormValue(formData, key)

  if (value.length > 2000) {
    redirectFromAdminReviews(
      'error',
      `${label}は2000文字以内で入力してください。`
    )
  }

  return value || null
}

function getRequiredText(
  formData: FormData,
  key: string,
  label: string
) {
  const value = getFormValue(formData, key)

  if (!value) {
    redirectFromAdminReviews(
      'error',
      `${label}を入力してください。`
    )
  }

  if (value.length > 2000) {
    redirectFromAdminReviews(
      'error',
      `${label}は2000文字以内で入力してください。`
    )
  }

  return value
}

async function getAuthenticatedClient() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  return supabase
}

function handleAdminRpcError(
  context: string,
  error: RpcError
): never {
  console.error(context, error)

  if (error.code === '42501') {
    redirectFromAdminReviews(
      'error',
      'Admin権限が必要です。'
    )
  }

  if (error.code === 'P0002') {
    redirectFromAdminReviews(
      'error',
      '審査対象が見つかりませんでした。'
    )
  }

  if (error.code === '55000') {
    redirectFromAdminReviews(
      'error',
      'この審査依頼はすでに処理されています。'
    )
  }

  if (error.code === '22023') {
    redirectFromAdminReviews(
      'error',
      error.message ??
        '入力内容を確認してください。'
    )
  }

  redirectFromAdminReviews(
    'error',
    '審査処理を完了できませんでした。'
  )
}

function finishAdminAction(
  message: string
): never {
  revalidatePath('/admin/reviews')

  redirectFromAdminReviews(
    'message',
    message
  )
}

export async function approveAdminReviewAction(
  formData: FormData
) {
  const reviewRequestId =
    getReviewRequestId(formData)

  const adminComment = getOptionalText(
    formData,
    'admin_comment',
    'Adminコメント'
  )

  const userMessage = getOptionalText(
    formData,
    'user_message',
    'ユーザー向けメッセージ'
  )

  const supabase =
    await getAuthenticatedClient()

  const { error } = await supabase.rpc(
    'admin_approve_tag_review',
    {
      p_review_request_id:
        reviewRequestId,
      p_admin_comment: adminComment,
      p_user_message: userMessage,
    }
  )

  if (error) {
    handleAdminRpcError(
      'Admin tag approval failed:',
      error
    )
  }

  finishAdminAction(
    'タグを公開可能として承認しました。'
  )
}

export async function removeAdminReviewAction(
  formData: FormData
) {
  const reviewRequestId =
    getReviewRequestId(formData)

  const adminComment = getRequiredText(
    formData,
    'admin_comment',
    'Adminコメント'
  )

  const userMessage = getRequiredText(
    formData,
    'user_message',
    'ユーザー向けメッセージ'
  )

  const supabase =
    await getAuthenticatedClient()

  const { error } = await supabase.rpc(
    'admin_remove_tag_review',
    {
      p_review_request_id:
        reviewRequestId,
      p_admin_comment: adminComment,
      p_user_message: userMessage,
    }
  )

  if (error) {
    handleAdminRpcError(
      'Admin tag removal failed:',
      error
    )
  }

  finishAdminAction(
    'タグを削除し、審査を解決しました。'
  )
}

export async function requestUserActionAdminReviewAction(
  formData: FormData
) {
  const reviewRequestId =
    getReviewRequestId(formData)

  const adminComment = getRequiredText(
    formData,
    'admin_comment',
    'Adminコメント'
  )

  const userMessage = getRequiredText(
    formData,
    'user_message',
    'ユーザー向けメッセージ'
  )

  const supabase =
    await getAuthenticatedClient()

  const { error } = await supabase.rpc(
    'admin_request_user_action_review',
    {
      p_review_request_id:
        reviewRequestId,
      p_admin_comment: adminComment,
      p_user_message: userMessage,
    }
  )

  if (error) {
    handleAdminRpcError(
      'Admin user action request failed:',
      error
    )
  }

  finishAdminAction(
    'ユーザー対応待ちに変更しました。'
  )
}

export async function forcePrivateAdminReviewAction(
  formData: FormData
) {
  const reviewRequestId =
    getReviewRequestId(formData)

  const adminComment = getRequiredText(
    formData,
    'admin_comment',
    'Adminコメント'
  )

  const userMessage = getRequiredText(
    formData,
    'user_message',
    'ユーザー向けメッセージ'
  )

  const supabase =
    await getAuthenticatedClient()

  const { error } = await supabase.rpc(
    'admin_force_private_review',
    {
      p_review_request_id:
        reviewRequestId,
      p_admin_comment: adminComment,
      p_user_message: userMessage,
    }
  )

  if (error) {
    handleAdminRpcError(
      'Admin force-private action failed:',
      error
    )
  }

  finishAdminAction(
    'プロフィールを強制非公開にし、タグを削除しました。'
  )
}