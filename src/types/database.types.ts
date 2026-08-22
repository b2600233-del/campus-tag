export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.15"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      ai_tag_regeneration_batches: {
        Row: {
          candidate_payload: Json
          consumed_at: string | null
          created_at: string
          expires_at: string
          id: string
          profile_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          candidate_payload: Json
          consumed_at?: string | null
          created_at?: string
          expires_at: string
          id?: string
          profile_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          candidate_payload?: Json
          consumed_at?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          profile_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_tag_regeneration_batches_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_tag_regeneration_batches_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_usage_state: {
        Row: {
          created_at: string
          safety_screening_last_request_at: string | null
          safety_screening_successful_count: number
          search_last_request_at: string | null
          search_successful_count: number
          tag_generation_last_request_at: string | null
          tag_generation_successful_count: number
          updated_at: string
          usage_date: string
          user_id: string
        }
        Insert: {
          created_at?: string
          safety_screening_last_request_at?: string | null
          safety_screening_successful_count?: number
          search_last_request_at?: string | null
          search_successful_count?: number
          tag_generation_last_request_at?: string | null
          tag_generation_successful_count?: number
          updated_at?: string
          usage_date?: string
          user_id: string
        }
        Update: {
          created_at?: string
          safety_screening_last_request_at?: string | null
          safety_screening_successful_count?: number
          search_last_request_at?: string | null
          search_successful_count?: number
          tag_generation_last_request_at?: string | null
          tag_generation_successful_count?: number
          updated_at?: string
          usage_date?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_usage_state_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
        ]
      }
      app_users: {
        Row: {
          account_status: string
          account_type: string
          created_at: string
          current_suspension_reason: string | null
          id: string
          role: string
          student_number: string | null
          suspended_at: string | null
          suspended_by_user_id: string | null
          updated_at: string
        }
        Insert: {
          account_status?: string
          account_type?: string
          created_at?: string
          current_suspension_reason?: string | null
          id: string
          role?: string
          student_number?: string | null
          suspended_at?: string | null
          suspended_by_user_id?: string | null
          updated_at?: string
        }
        Update: {
          account_status?: string
          account_type?: string
          created_at?: string
          current_suspension_reason?: string | null
          id?: string
          role?: string
          student_number?: string | null
          suspended_at?: string | null
          suspended_by_user_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "app_users_suspended_by_user_id_fkey"
            columns: ["suspended_by_user_id"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
        ]
      }
      languages: {
        Row: {
          code: string
          created_at: string
          id: string
          is_active: boolean
          name_en: string
          name_ja: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          is_active?: boolean
          name_en: string
          name_ja: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name_en?: string
          name_ja?: string
          updated_at?: string
        }
        Relationships: []
      }
      profile_languages: {
        Row: {
          can_speak: boolean
          created_at: string
          id: string
          is_learning: boolean
          is_native: boolean
          language_id: string
          profile_id: string
          updated_at: string
          wants_to_interact: boolean
        }
        Insert: {
          can_speak?: boolean
          created_at?: string
          id?: string
          is_learning?: boolean
          is_native?: boolean
          language_id: string
          profile_id: string
          updated_at?: string
          wants_to_interact?: boolean
        }
        Update: {
          can_speak?: boolean
          created_at?: string
          id?: string
          is_learning?: boolean
          is_native?: boolean
          language_id?: string
          profile_id?: string
          updated_at?: string
          wants_to_interact?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "profile_languages_language_id_fkey"
            columns: ["language_id"]
            isOneToOne: false
            referencedRelation: "languages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profile_languages_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_tags: {
        Row: {
          created_at: string
          id: string
          profile_id: string
          review_status: string
          safety_checked_at: string | null
          safety_reason_category: string | null
          safety_reason_summary: string | null
          safety_screening_status: string
          source: string
          tag_text: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          profile_id: string
          review_status?: string
          safety_checked_at?: string | null
          safety_reason_category?: string | null
          safety_reason_summary?: string | null
          safety_screening_status?: string
          source?: string
          tag_text: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          profile_id?: string
          review_status?: string
          safety_checked_at?: string | null
          safety_reason_category?: string | null
          safety_reason_summary?: string | null
          safety_screening_status?: string
          source?: string
          tag_text?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profile_tags_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          bio: string | null
          birth_date: string | null
          cohort_number: number | null
          created_at: string
          display_name: string | null
          exchange_grade_level: string | null
          id: string
          is_forced_private: boolean
          is_public: boolean
          student_type: string | null
          student_type_other_text: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          bio?: string | null
          birth_date?: string | null
          cohort_number?: number | null
          created_at?: string
          display_name?: string | null
          exchange_grade_level?: string | null
          id?: string
          is_forced_private?: boolean
          is_public?: boolean
          student_type?: string | null
          student_type_other_text?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          bio?: string | null
          birth_date?: string | null
          cohort_number?: number | null
          created_at?: string
          display_name?: string | null
          exchange_grade_level?: string | null
          id?: string
          is_forced_private?: boolean
          is_public?: boolean
          student_type?: string | null
          student_type_other_text?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
        ]
      }
      review_requests: {
        Row: {
          admin_comment: string | null
          closed_at: string | null
          created_at: string
          editor_comment: string | null
          id: string
          problematic_content_snapshot: string | null
          profile_id: string | null
          reason_category: string
          requested_by: string | null
          resolution_action: string | null
          status: string
          tag_id: string | null
          target_display_name_snapshot: string | null
          target_field: string | null
          target_tag_snapshot: string | null
          target_tag_source_snapshot: string | null
          target_user_id: string | null
          updated_at: string
          user_message: string | null
        }
        Insert: {
          admin_comment?: string | null
          closed_at?: string | null
          created_at?: string
          editor_comment?: string | null
          id?: string
          problematic_content_snapshot?: string | null
          profile_id?: string | null
          reason_category: string
          requested_by?: string | null
          resolution_action?: string | null
          status?: string
          tag_id?: string | null
          target_display_name_snapshot?: string | null
          target_field?: string | null
          target_tag_snapshot?: string | null
          target_tag_source_snapshot?: string | null
          target_user_id?: string | null
          updated_at?: string
          user_message?: string | null
        }
        Update: {
          admin_comment?: string | null
          closed_at?: string | null
          created_at?: string
          editor_comment?: string | null
          id?: string
          problematic_content_snapshot?: string | null
          profile_id?: string | null
          reason_category?: string
          requested_by?: string | null
          resolution_action?: string | null
          status?: string
          tag_id?: string | null
          target_display_name_snapshot?: string | null
          target_field?: string | null
          target_tag_snapshot?: string | null
          target_tag_source_snapshot?: string | null
          target_user_id?: string | null
          updated_at?: string
          user_message?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "review_requests_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_requests_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_requests_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "profile_tags"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_requests_target_user_id_fkey"
            columns: ["target_user_id"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      public_profiles: {
        Row: {
          age: number | null
          bio: string | null
          cohort_number: number | null
          display_name: string | null
          exchange_grade_level: string | null
          languages: Json | null
          profile_id: string | null
          student_type: string | null
          student_type_other_text: string | null
          tags: string[] | null
        }
        Relationships: []
      }
    }
    Functions: {
      get_public_profiles: {
        Args: { p_limit?: number; p_profile_ids?: string[] }
        Returns: {
          age: number
          bio: string
          cohort_number: number
          display_name: string
          exchange_grade_level: string
          languages: Json
          profile_id: string
          student_type: string
          student_type_other_text: string
          tags: string[]
        }[]
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
