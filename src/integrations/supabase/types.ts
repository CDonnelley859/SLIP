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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      cards: {
        Row: {
          created_at: string
          id: string
          post_time: string
          race_date: string
          source_id: string | null
          status: string
          track_name: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_time: string
          race_date: string
          source_id?: string | null
          status?: string
          track_name: string
        }
        Update: {
          created_at?: string
          id?: string
          post_time?: string
          race_date?: string
          source_id?: string | null
          status?: string
          track_name?: string
        }
        Relationships: []
      }
      horses: {
        Row: {
          id: string
          jockey: string | null
          name: string
          number: number
          odds: string | null
          race_id: string
        }
        Insert: {
          id?: string
          jockey?: string | null
          name: string
          number: number
          odds?: string | null
          race_id: string
        }
        Update: {
          id?: string
          jockey?: string | null
          name?: string
          number?: number
          odds?: string | null
          race_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "horses_race_id_fkey"
            columns: ["race_id"]
            isOneToOne: false
            referencedRelation: "races"
            referencedColumns: ["id"]
          },
        ]
      }
      picks: {
        Row: {
          created_at: string
          horse_id: string
          id: string
          points: number | null
          race_id: string
          scrum_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          horse_id: string
          id?: string
          points?: number | null
          race_id: string
          scrum_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          horse_id?: string
          id?: string
          points?: number | null
          race_id?: string
          scrum_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "picks_horse_id_fkey"
            columns: ["horse_id"]
            isOneToOne: false
            referencedRelation: "horses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "picks_race_id_fkey"
            columns: ["race_id"]
            isOneToOne: false
            referencedRelation: "races"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "picks_scrum_id_fkey"
            columns: ["scrum_id"]
            isOneToOne: false
            referencedRelation: "scrums"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          cap_color: string
          created_at: string
          handle: string
          id: string
        }
        Insert: {
          cap_color?: string
          created_at?: string
          handle: string
          id: string
        }
        Update: {
          cap_color?: string
          created_at?: string
          handle?: string
          id?: string
        }
        Relationships: []
      }
      races: {
        Row: {
          card_id: string
          id: string
          name: string | null
          off_time: string
          race_number: number
          status: string
          winners: Json | null
        }
        Insert: {
          card_id: string
          id?: string
          name?: string | null
          off_time: string
          race_number: number
          status?: string
          winners?: Json | null
        }
        Update: {
          card_id?: string
          id?: string
          name?: string | null
          off_time?: string
          race_number?: number
          status?: string
          winners?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "races_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "cards"
            referencedColumns: ["id"]
          },
        ]
      }
      scrum_members: {
        Row: {
          joined_at: string
          scrum_id: string
          user_id: string
        }
        Insert: {
          joined_at?: string
          scrum_id: string
          user_id: string
        }
        Update: {
          joined_at?: string
          scrum_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "scrum_members_scrum_id_fkey"
            columns: ["scrum_id"]
            isOneToOne: false
            referencedRelation: "scrums"
            referencedColumns: ["id"]
          },
        ]
      }
      scrum_results: {
        Row: {
          finalized_at: string | null
          place: number
          rank: number | null
          scrum_id: string
          show: number
          total_points: number
          user_id: string
          wins: number
        }
        Insert: {
          finalized_at?: string | null
          place?: number
          rank?: number | null
          scrum_id: string
          show?: number
          total_points?: number
          user_id: string
          wins?: number
        }
        Update: {
          finalized_at?: string | null
          place?: number
          rank?: number | null
          scrum_id?: string
          show?: number
          total_points?: number
          user_id?: string
          wins?: number
        }
        Relationships: [
          {
            foreignKeyName: "scrum_results_scrum_id_fkey"
            columns: ["scrum_id"]
            isOneToOne: false
            referencedRelation: "scrums"
            referencedColumns: ["id"]
          },
        ]
      }
      scrums: {
        Row: {
          card_id: string
          created_at: string
          host_id: string
          id: string
          join_code: string
          name: string
        }
        Insert: {
          card_id: string
          created_at?: string
          host_id: string
          id?: string
          join_code: string
          name: string
        }
        Update: {
          card_id?: string
          created_at?: string
          host_id?: string
          id?: string
          join_code?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "scrums_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "cards"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_scrum_member: {
        Args: { _scrum_id: string; _user_id: string }
        Returns: boolean
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
  public: {
    Enums: {},
  },
} as const
