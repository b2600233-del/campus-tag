'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { createClient } from '@/lib/supabase/server'

function getFormValue(
  formData: FormData,
  key: string
) {
  const value = formData.get(key)

  return typeof value === 'string'
    ? value.trim()
    : ''
}

function redirectFromEditor(
  key: 'error' | 'message',
  message: string
): never {
  const params = new URLSearchParams({
    [key]: message,
  })

  redirect(
    `/editor/tags?${params.toString()}`
  )
}

export async function approveEditorTagAction(
  formData: FormData
) {
  const tagId = getFormValue(
    formData,
    'tag_id'
  )

  if (!tagId) {
    redirectFromEditor(
      'error',
      '審査対象のタグを確認できませんでした。'
    )
  }

  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const {
    data: approved,
    error: approveError,
  } = await supabase.rpc(
    'approve_editor_tag',
    {
      p_tag_id: tagId,
    }
  )

  if (approveError) {
    console.error(
      'Editor tag approval failed:',
      approveError
    )

    if (approveError.code === '42501') {
      redirectFromEditor(
        'error',
        'Editor権限が必要です。'
      )
    }

    redirectFromEditor(
      'error',
      'タグを承認できませんでした。'
    )
  }

  if (approved !== true) {
    redirectFromEditor(
      'error',
      'このタグは既に処理された可能性があります。'
    )
  }

  revalidatePath('/editor/tags')

  redirectFromEditor(
    'message',
    'タグを公開可能として承認しました。'
  )
}

export async function escalateEditorTagAction(
  formData: FormData
) {
  const tagId = getFormValue(
    formData,
    'tag_id'
  )

  const editorComment = getFormValue(
    formData,
    'editor_comment'
  )

  if (!tagId) {
    redirectFromEditor(
      'error',
      '審査対象のタグを確認できませんでした。'
    )
  }

  if (!editorComment) {
    redirectFromEditor(
      'error',
      'Adminへの申し送りを入力してください。'
    )
  }

  if (editorComment.length > 1000) {
    redirectFromEditor(
      'error',
      '申し送りは1000文字以内で入力してください。'
    )
  }

  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const {
    data: escalated,
    error: escalateError,
  } = await supabase.rpc(
    'escalate_editor_tag',
    {
      p_tag_id: tagId,
      p_editor_comment: editorComment,
    }
  )

  if (escalateError) {
    console.error(
      'Editor tag escalation failed:',
      escalateError
    )

    if (escalateError.code === '42501') {
      redirectFromEditor(
        'error',
        'Editor権限が必要です。'
      )
    }

    redirectFromEditor(
      'error',
      'タグをAdminへ送れませんでした。'
    )
  }

  if (escalated !== true) {
    redirectFromEditor(
      'error',
      'このタグは既に処理された可能性があります。'
    )
  }

  revalidatePath('/editor/tags')

  redirectFromEditor(
    'message',
    'タグをAdminの審査へ送りました。'
  )
}