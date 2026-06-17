export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      research_sessions: {
        Row: {
          id: string;
          user_id: string;
          query: string;
          intent: string | null;
          keywords: Json | null;
          trigger_type: string;
          schedule_id: string | null;
          status: string;
          model: string | null;
          config: Json;
          created_at: string;
          completed_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          query: string;
          intent?: string | null;
          keywords?: Json | null;
          trigger_type?: string;
          schedule_id?: string | null;
          status?: string;
          model?: string | null;
          config?: Json;
          created_at?: string;
          completed_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          query?: string;
          intent?: string | null;
          keywords?: Json | null;
          trigger_type?: string;
          schedule_id?: string | null;
          status?: string;
          model?: string | null;
          config?: Json;
          created_at?: string;
          completed_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "research_sessions_schedule_id_fkey";
            columns: ["schedule_id"];
            isOneToOne: false;
            referencedRelation: "research_schedules";
            referencedColumns: ["id"];
          },
        ];
      };
      sources: {
        Row: {
          id: string;
          session_id: string;
          url: string;
          title: string | null;
          domain: string | null;
          domain_score: number | null;
          ai_score: number | null;
          total_score: number | null;
          content_text: string | null;
          language: string | null;
          published_at: string | null;
          is_used: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          session_id: string;
          url: string;
          title?: string | null;
          domain?: string | null;
          domain_score?: number | null;
          ai_score?: number | null;
          total_score?: number | null;
          content_text?: string | null;
          language?: string | null;
          published_at?: string | null;
          is_used?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          session_id?: string;
          url?: string;
          title?: string | null;
          domain?: string | null;
          domain_score?: number | null;
          ai_score?: number | null;
          total_score?: number | null;
          content_text?: string | null;
          language?: string | null;
          published_at?: string | null;
          is_used?: boolean;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "sources_session_id_fkey";
            columns: ["session_id"];
            isOneToOne: false;
            referencedRelation: "research_sessions";
            referencedColumns: ["id"];
          },
        ];
      };
      summaries: {
        Row: {
          id: string;
          session_id: string;
          content: string;
          language: string;
          citations: Json | null;
          confidence: number | null;
          gaps: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          session_id: string;
          content: string;
          language?: string;
          citations?: Json | null;
          confidence?: number | null;
          gaps?: Json | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          session_id?: string;
          content?: string;
          language?: string;
          citations?: Json | null;
          confidence?: number | null;
          gaps?: Json | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "summaries_session_id_fkey";
            columns: ["session_id"];
            isOneToOne: false;
            referencedRelation: "research_sessions";
            referencedColumns: ["id"];
          },
        ];
      };
      translations: {
        Row: {
          id: string;
          session_id: string;
          original_text: string;
          translated: string;
          glossary: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          session_id: string;
          original_text: string;
          translated: string;
          glossary?: Json | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          session_id?: string;
          original_text?: string;
          translated?: string;
          glossary?: Json | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "translations_session_id_fkey";
            columns: ["session_id"];
            isOneToOne: false;
            referencedRelation: "research_sessions";
            referencedColumns: ["id"];
          },
        ];
      };
      research_schedules: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          query: string;
          cron_expr: string;
          model: string;
          config: Json;
          is_active: boolean;
          last_run_at: string | null;
          next_run_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          query: string;
          cron_expr: string;
          model?: string;
          config?: Json;
          is_active?: boolean;
          last_run_at?: string | null;
          next_run_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          query?: string;
          cron_expr?: string;
          model?: string;
          config?: Json;
          is_active?: boolean;
          last_run_at?: string | null;
          next_run_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      trend_analyses: {
        Row: {
          id: string;
          user_id: string;
          analysis_type: string;
          scope_query: string | null;
          session_count: number | null;
          input_summary: Json | null;
          result: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          analysis_type: string;
          scope_query?: string | null;
          session_count?: number | null;
          input_summary?: Json | null;
          result: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          analysis_type?: string;
          scope_query?: string | null;
          session_count?: number | null;
          input_summary?: Json | null;
          result?: Json;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

export type ResearchSession = Database['public']['Tables']['research_sessions']['Row'];
export type Source = Database['public']['Tables']['sources']['Row'];
export type Summary = Database['public']['Tables']['summaries']['Row'];
export type Translation = Database['public']['Tables']['translations']['Row'];
export type ResearchSchedule = Database['public']['Tables']['research_schedules']['Row'];
export type TrendAnalysis = Database['public']['Tables']['trend_analyses']['Row'];
