'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { createClient } from '@/lib/supabase/server'

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const USER_ROLES = new Set(['viewer', 'editor', 'admin'])

type RpcError = {
  code?: string
  message?: string
}

type NoticeType = 'message' | 'error'

function getFormText(formData: FormData, key: string) {
  const value = formData.get(key)

  return typeof value === 'string' ? value.trim() : ''
}

function getReturnSearch(formData: FormData) {
  return getFormText(formData, 'return_search').slice(0, 100)
}

function redirectToAdminUsers(
  type: NoticeType,
  notice: string,
  search = '',
): never {
  const params = new URLSearchParams({
    [type]: notice,
  })

  if (search) {
    params.set('q', search)
  }

  redirect(`/admin/users?${params.toString()}`)
}

function getRpcErrorMessage(error: RpcError) {
  const message = error.message?.toLowerCase() ?? ''

  if (error.code === '42501') {
    return 'この操作にはAdmin権限が必要です。'
  }

  if (error.code === 'P0002') {
    return '対象のユーザーまたはプロフィールが見つかりませんでした。'
  }

  if (error.code === '22023') {
    return '入力内容が正しくありません。内容を確認してください。'
  }

  if (error.code === '55000') {
    if (message.includes('own admin')) {
      return '自分自身のAdmin権限は解除できません。'
    }

    if (message.includes('own account')) {
      return '自分自身のアカウントは停止できません。'
    }

    if (message.includes('final active admin')) {
      return '最後の有効なAdminは降格または停止できません。'
    }

    if (message.includes('already suspended')) {
      return 'このアカウントはすでに停止されています。'
    }

    if (message.includes('already active')) {
      return 'このアカウントはすでに有効です。'
    }

    return '安全保護のため、この操作は実行できませんでした。'
  }

  if (error.code === 'PGRST202') {
    return 'Supabaseのユーザー管理関数が見つかりません。スキーマの反映を確認してください。'
  }

  return 'ユーザー管理操作に失敗しました。時間をおいて再度お試しください。'
}

async function getAuthenticatedClient() {
  const supabase = await createClient()

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    redirect('/login')
  }

  return supabase
}

function revalidateUserManagementPages() {
  revalidatePath('/admin/users')
  revalidatePath('/admin/reviews')
  revalidatePath('/editor/tags')
  revalidatePath('/search')
  revalidatePath('/account')
  revalidatePath('/profile/publication')
}

export async function changeAdminUserRoleAction(formData: FormData) {
  const targetUserId = getFormText(formData, 'target_user_id')
  const newRole = getFormText(formData, 'new_role').toLowerCase()
  const returnSearch = getReturnSearch(formData)

  if (!UUID_PATTERN.test(targetUserId)) {
    redirectToAdminUsers(
      'error',
      '対象ユーザーのIDが正しくありません。',
      returnSearch,
    )
  }

  if (!USER_ROLES.has(newRole)) {
    redirectToAdminUsers(
      'error',
      'ロールはViewer、Editor、Adminから選択してください。',
      returnSearch,
    )
  }

  const supabase = await getAuthenticatedClient()

  const { error } = await supabase.rpc('admin_set_user_role', {
    p_target_user_id: targetUserId,
    p_new_role: newRole,
  })

  if (error) {
    redirectToAdminUsers(
      'error',
      getRpcErrorMessage(error),
      returnSearch,
    )
  }

  revalidateUserManagementPages()

  redirectToAdminUsers(
    'message',
    `ユーザーのロールを${newRole}へ変更しました。`,
    returnSearch,
  )
}

export async function suspendAdminUserAction(formData: FormData) {
  const targetUserId = getFormText(formData, 'target_user_id')
  const reason = getFormText(formData, 'reason')
  const returnSearch = getReturnSearch(formData)

  if (!UUID_PATTERN.test(targetUserId)) {
    redirectToAdminUsers(
      'error',
      '対象ユーザーのIDが正しくありません。',
      returnSearch,
    )
  }

  if (!reason) {
    redirectToAdminUsers(
      'error',
      'アカウントを停止する理由を入力してください。',
      returnSearch,
    )
  }

  if (reason.length > 1000) {
    redirectToAdminUsers(
      'error',
      '停止理由は1000文字以内で入力してください。',
      returnSearch,
    )
  }

  const supabase = await getAuthenticatedClient()

  const { error } = await supabase.rpc('admin_suspend_user', {
    p_target_user_id: targetUserId,
    p_reason: reason,
  })

  if (error) {
    redirectToAdminUsers(
      'error',
      getRpcErrorMessage(error),
      returnSearch,
    )
  }

  revalidateUserManagementPages()

  redirectToAdminUsers(
    'message',
    'ユーザーのアカウントを停止しました。',
    returnSearch,
  )
}

export async function reactivateAdminUserAction(formData: FormData) {
  const targetUserId = getFormText(formData, 'target_user_id')
  const returnSearch = getReturnSearch(formData)

  if (!UUID_PATTERN.test(targetUserId)) {
    redirectToAdminUsers(
      'error',
      '対象ユーザーのIDが正しくありません。',
      returnSearch,
    )
  }

  const supabase = await getAuthenticatedClient()

  const { error } = await supabase.rpc('admin_reactivate_user', {
    p_target_user_id: targetUserId,
  })

  if (error) {
    redirectToAdminUsers(
      'error',
      getRpcErrorMessage(error),
      returnSearch,
    )
  }

  revalidateUserManagementPages()

  redirectToAdminUsers(
    'message',
    'ユーザーのアカウントを再開しました。',
    returnSearch,
  )
}

export async function forcePrivateAdminUserAction(formData: FormData) {
  const targetUserId = getFormText(formData, 'target_user_id')
  const returnSearch = getReturnSearch(formData)

  if (!UUID_PATTERN.test(targetUserId)) {
    redirectToAdminUsers(
      'error',
      '対象ユーザーのIDが正しくありません。',
      returnSearch,
    )
  }

  const supabase = await getAuthenticatedClient()

  const { error } = await supabase.rpc(
    'admin_set_profile_forced_private',
    {
      p_target_user_id: targetUserId,
      p_forced_private: true,
    },
  )

  if (error) {
    redirectToAdminUsers(
      'error',
      getRpcErrorMessage(error),
      returnSearch,
    )
  }

  revalidateUserManagementPages()

  redirectToAdminUsers(
    'message',
    'ユーザーのプロフィールを強制非公開にしました。',
    returnSearch,
  )
}

export async function releaseForcedPrivateAdminUserAction(
  formData: FormData,
) {
  const targetUserId = getFormText(formData, 'target_user_id')
  const returnSearch = getReturnSearch(formData)

  if (!UUID_PATTERN.test(targetUserId)) {
    redirectToAdminUsers(
      'error',
      '対象ユーザーのIDが正しくありません。',
      returnSearch,
    )
  }

  const supabase = await getAuthenticatedClient()

  const { error } = await supabase.rpc(
    'admin_set_profile_forced_private',
    {
      p_target_user_id: targetUserId,
      p_forced_private: false,
    },
  )

  if (error) {
    redirectToAdminUsers(
      'error',
      getRpcErrorMessage(error),
      returnSearch,
    )
  }

  revalidateUserManagementPages()

  redirectToAdminUsers(
    'message',
    'プロフィールの強制非公開を解除しました。公開状態は非公開のままです。',
    returnSearch,
  )
}