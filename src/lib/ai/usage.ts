import type { SupabaseClient } from '@supabase/supabase-js'

import type { Database } from '@/types/database.types'

export type AiFeature =
  | 'search'
  | 'tag_generation'
  | 'safety_screening'

export class AiUsageLimitError extends Error {}

export async function runTrackedAiRequest<T>(
  supabase: SupabaseClient<Database>,
  feature: AiFeature,
  operation: () => Promise<T>,
) {
  const { data, error } = await supabase.rpc(
    'begin_ai_request',
    { p_feature: feature },
  )

  const state = data?.[0]

  if (error || !state) {
    console.error('AI usage check failed:', error)
    throw new Error('AI_USAGE_CHECK_FAILED')
  }

  if (!state.allowed) {
    if (state.denial_reason === 'cooldown') {
      throw new AiUsageLimitError(
        `${state.retry_after_seconds}秒ほど待ってから、もう一度お試しください。`,
      )
    }

    throw new AiUsageLimitError(
      '本日のAI利用回数の上限に達しました。明日もう一度お試しください。',
    )
  }

  const result = await operation()
  const { error: recordError } = await supabase.rpc(
    'record_ai_success',
    { p_feature: feature },
  )

  if (recordError) {
    console.error('AI usage success recording failed:', recordError)
  }

  return result
}
