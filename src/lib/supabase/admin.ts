import 'server-only'

import { createClient } from '@supabase/supabase-js'

import type { Database } from '@/types/database.types'

export function createAdminClient() {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL
  const secretKey =
    process.env.SUPABASE_SECRET_KEY

  if (!supabaseUrl) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URLが設定されていません。'
    )
  }

  if (!secretKey) {
    throw new Error(
      'SUPABASE_SECRET_KEYが設定されていません。'
    )
  }

  return createClient<Database>(
    supabaseUrl,
    secretKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    }
  )
}