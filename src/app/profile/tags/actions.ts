'use server'

import { redirect } from 'next/navigation'

import { screenTagSafety } from '@/lib/gemini/safety'
import { generateTagCandidates } from '@/lib/gemini/tags'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

const MAX_TAG_LENGTH = 60
const MAX_TAG_COUNT = 12
const CANDIDATE_EXPIRY_MINUTES = 30

type StoredTagCandidate = {
  candidate_id: string
  tag_text: string
}

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
    user,
    profile,
  }
}

function readStoredCandidates(
  value: unknown,
): StoredTagCandidate[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value.flatMap((item) => {
    if (
      typeof item !== 'object' ||
      item === null ||
      typeof (item as Record<string, unknown>).candidate_id !==
        'string' ||
      typeof (item as Record<string, unknown>).tag_text !== 'string'
    ) {
      return []
    }

    return [
      {
        candidate_id: (item as Record<string, string>)
          .candidate_id,
        tag_text: (item as Record<string, string>).tag_text,
      },
    ]
  })
}

export async function generateProfileTagCandidatesAction() {
  const { supabase, user, profile } =
    await getCurrentProfile()

  const { data: profileDetails, error: detailsError } =
    await supabase
      .from('profiles')
      .select('display_name, student_type, bio')
      .eq('id', profile.id)
      .single()

  const { data: existingTags, error: tagsError } =
    await supabase
      .from('profile_tags')
      .select('tag_text')
      .eq('profile_id', profile.id)

  const { data: profileLanguages, error: languagesError } =
    await supabase
      .from('profile_languages')
      .select('language_id')
      .eq('profile_id', profile.id)

  if (detailsError || tagsError || languagesError) {
    redirectFromTags(
      'error',
      'タグ候補の生成に必要なプロフィール情報を読み込めませんでした。',
    )
  }

  const languageIds = (profileLanguages ?? []).map(
    (item) => item.language_id,
  )
  let languageNames: string[] = []

  if (languageIds.length > 0) {
    const { data: languages, error: languageNamesError } =
      await supabase
        .from('languages')
        .select('name_ja')
        .in('id', languageIds)

    if (languageNamesError) {
      redirectFromTags(
        'error',
        '言語情報を読み込めませんでした。',
      )
    }

    languageNames = (languages ?? []).map(
      (language) => language.name_ja,
    )
  }

  const currentTags = (existingTags ?? []).map(
    (tag) => tag.tag_text,
  )
  const remainingCount = MAX_TAG_COUNT - currentTags.length

  if (remainingCount < 1) {
    redirectFromTags(
      'error',
      'タグが上限に達しているため候補を生成できません。',
    )
  }

  const candidates = await generateTagCandidates(
    {
      displayName: profileDetails.display_name,
      studentType: profileDetails.student_type,
      bio: profileDetails.bio,
      languages: languageNames,
      existingTags: currentTags,
    },
    remainingCount,
  ).catch((error: unknown) => {
    console.error('Tag candidate generation failed:', error)
    redirectFromTags(
      'error',
      'AIタグ候補の生成に失敗しました。時間をおいて再度お試しください。',
    )
  })

  const admin = createAdminClient()
  const now = new Date()

  await admin
    .from('ai_tag_regeneration_batches')
    .update({ consumed_at: now.toISOString() })
    .eq('user_id', user.id)
    .eq('profile_id', profile.id)
    .is('consumed_at', null)

  const expiresAt = new Date(
    now.getTime() + CANDIDATE_EXPIRY_MINUTES * 60 * 1000,
  )

  const { error: batchError } = await admin
    .from('ai_tag_regeneration_batches')
    .insert({
      user_id: user.id,
      profile_id: profile.id,
      candidate_payload: candidates.map((tagText) => ({
        candidate_id: crypto.randomUUID(),
        tag_text: tagText,
      })),
      expires_at: expiresAt.toISOString(),
    })

  if (batchError) {
    console.error('Tag candidate batch insert failed:', batchError)
    redirectFromTags(
      'error',
      'AIタグ候補を保存できませんでした。',
    )
  }

  redirectFromTags(
    'message',
    'AIタグ候補を生成しました。採用する候補を選んでください。',
  )
}

export async function adoptProfileTagCandidatesAction(
  formData: FormData,
) {
  const batchId = getFormValue(formData, 'batchId')
  const selectedIds = formData
    .getAll('candidateId')
    .filter((value): value is string => typeof value === 'string')

  if (!batchId || selectedIds.length === 0) {
    redirectFromTags(
      'error',
      '採用するタグ候補を1つ以上選択してください。',
    )
  }

  const { user, profile } = await getCurrentProfile()
  const admin = createAdminClient()
  const now = new Date().toISOString()

  const { data: batch, error: batchError } = await admin
    .from('ai_tag_regeneration_batches')
    .select('candidate_payload, expires_at, consumed_at')
    .eq('id', batchId)
    .eq('user_id', user.id)
    .eq('profile_id', profile.id)
    .maybeSingle()

  if (
    batchError ||
    !batch ||
    batch.consumed_at ||
    batch.expires_at <= now
  ) {
    redirectFromTags(
      'error',
      'タグ候補の有効期限が切れています。もう一度生成してください。',
    )
  }

  const allowedCandidates = readStoredCandidates(
    batch.candidate_payload,
  )
  const selectedSet = new Set(selectedIds)
  const selected = allowedCandidates.filter((candidate) =>
    selectedSet.has(candidate.candidate_id),
  )

  if (selected.length !== new Set(selectedIds).size) {
    redirectFromTags(
      'error',
      '選択されたタグ候補を確認できませんでした。',
    )
  }

  const { count, error: countError } = await admin
    .from('profile_tags')
    .select('id', { count: 'exact', head: true })
    .eq('profile_id', profile.id)

  if (countError || (count ?? 0) + selected.length > MAX_TAG_COUNT) {
    redirectFromTags(
      'error',
      '選択した候補を追加するとタグの上限を超えます。',
    )
  }

  const rows = await Promise.all(
    selected.map(async (candidate) => {
      const safetyResult = await screenTagSafety(candidate.tag_text)

      return {
        profile_id: profile.id,
        tag_text: candidate.tag_text,
        source: 'ai_generated',
        review_status:
          safetyResult.status === 'passed'
            ? 'clear'
            : 'needs_editor_review',
        safety_screening_status: safetyResult.status,
        safety_reason_category: safetyResult.reasonCategory,
        safety_reason_summary: safetyResult.reasonSummary,
        safety_checked_at: new Date().toISOString(),
      }
    }),
  ).catch((error: unknown) => {
    console.error('Generated tag safety screening failed:', error)
    redirectFromTags(
      'error',
      'AIタグ候補の安全確認に失敗しました。',
    )
  })

  const { error: insertError } = await admin
    .from('profile_tags')
    .insert(rows)

  if (insertError) {
    console.error('Generated tag insert failed:', insertError)
    redirectFromTags(
      'error',
      insertError.code === '23505'
        ? '既に登録されているタグが含まれています。'
        : '選択したAIタグ候補を保存できませんでした。',
    )
  }

  await admin
    .from('ai_tag_regeneration_batches')
    .update({ consumed_at: now })
    .eq('id', batchId)
    .is('consumed_at', null)

  redirectFromTags(
    'message',
    `${selected.length}件のAIタグ候補を採用しました。`,
  )
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
