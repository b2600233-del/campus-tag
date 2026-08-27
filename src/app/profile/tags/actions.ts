'use server'

import { redirect } from 'next/navigation'

import { screenTagSafety } from '@/lib/gemini/safety'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

const MAX_TAG_LENGTH = 60

function getFormValue(
  formData: FormData,
  key: string
) {
  const value = formData.get(key)

  return typeof value === 'string'
    ? value.trim()
    : ''
}

function redirectFromTags(
  key: 'error' | 'message',
  message: string
): never {
  const params = new URLSearchParams({
    [key]: message,
  })

  redirect(`/profile/tags?${params.toString()}`)
}

async function getCurrentProfile() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const {
    data: profile,
    error: profileError,
  } = await supabase
    .from('profiles')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (profileError || !profile) {
    const params = new URLSearchParams({
      error:
        '先に基本プロフィールを保存してください。',
    })

    redirect(`/profile/edit?${params.toString()}`)
  }

  return {
    supabase,
    profile,
  }
}

export async function saveProfileTagAction(
  formData: FormData
) {
  const tagText = getFormValue(
    formData,
    'tagText'
  )

  if (!tagText) {
    redirectFromTags(
      'error',
      'タグを入力してください。'
    )
  }

  if (tagText.length > MAX_TAG_LENGTH) {
    redirectFromTags(
      'error',
      `タグは${MAX_TAG_LENGTH}文字以内で入力してください。`
    )
  }

  const { profile } = await getCurrentProfile()

  const safetyResult = await screenTagSafety(
    tagText
  ).catch((error: unknown) => {
    console.error(
      'Tag safety screening failed:',
      error
    )

    redirectFromTags(
      'error',
      'タグの安全確認に失敗しました。時間をおいて再度お試しください。'
    )
  })

  const admin = createAdminClient()

  const { error: insertError } = await admin
    .from('profile_tags')
    .insert({
      profile_id: profile.id,
      tag_text: tagText,
      source: 'user_added',
      review_status:
        safetyResult.status === 'passed'
          ? 'clear'
          : 'needs_editor_review',
      safety_screening_status:
        safetyResult.status,
      safety_reason_category:
        safetyResult.reasonCategory,
      safety_reason_summary:
        safetyResult.reasonSummary,
      safety_checked_at:
        new Date().toISOString(),
    })

  if (insertError) {
    if (insertError.code === '23505') {
      redirectFromTags(
        'error',
        '同じタグは追加できません。'
      )
    }

    if (
      insertError.message.includes(
        'A profile cannot have more than 12 tags.'
      )
    ) {
      redirectFromTags(
        'error',
        'タグは最大12個まで登録できます。'
      )
    }

    console.error(
      'Profile tag insert failed:',
      insertError
    )

    redirectFromTags(
      'error',
      'タグを保存できませんでした。'
    )
  }

  if (safetyResult.status === 'flagged') {
    redirectFromTags(
      'message',
      'タグは安全確認で要確認となったため、公開せず確認待ちとして保存しました。'
    )
  }

  redirectFromTags(
    'message',
    'タグを追加しました。'
  )
}

export async function deleteProfileTagAction(
  formData: FormData
) {
  const tagId = getFormValue(formData, 'tagId')

  if (!tagId) {
    redirectFromTags(
      'error',
      '削除するタグを確認できませんでした。'
    )
  }

  const {
    supabase,
    profile,
  } = await getCurrentProfile()

  const { error: deleteError } = await supabase
    .from('profile_tags')
    .delete()
    .eq('id', tagId)
    .eq('profile_id', profile.id)

  if (deleteError) {
    console.error(
      'Profile tag deletion failed:',
      deleteError
    )

    redirectFromTags(
      'error',
      'タグを削除できませんでした。'
    )
  }

  redirectFromTags(
    'message',
    'タグを削除しました。'
  )
}