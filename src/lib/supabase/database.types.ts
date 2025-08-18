export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      rooms: {
        Row: {
          id: string
          code: string
          status: 'setup' | 'active' | 'completed' | 'paused'
          budget_default: number
          current_turn: number
          created_at: string
        }
        Insert: {
          id?: string
          code: string
          status?: 'setup' | 'active' | 'completed' | 'paused'
          budget_default?: number
          current_turn?: number
          created_at?: string
        }
        Update: {
          id?: string
          code?: string
          status?: 'setup' | 'active' | 'completed' | 'paused'
          budget_default?: number
          current_turn?: number
          created_at?: string
        }
      }
      participants: {
        Row: {
          id: string
          room_id: string
          display_name: string
          budget: number
          join_token: string
          join_url: string | null
          turn_order: number
          created_at: string
        }
        Insert: {
          id?: string
          room_id: string
          display_name: string
          budget: number
          join_token: string
          join_url?: string | null
          turn_order: number
          created_at?: string
        }
        Update: {
          id?: string
          room_id?: string
          display_name?: string
          budget?: number
          join_token?: string
          join_url?: string | null
          turn_order?: number
          created_at?: string
        }
      }
      players: {
        Row: {
          id: string
          room_id: string
          nome: string
          ruolo: 'P' | 'D' | 'C' | 'A'
          squadra: string
          player_id: number | null
          is_assigned: boolean
          assigned_to: string | null
          purchase_price: number
          created_at: string
        }
        Insert: {
          id?: string
          room_id: string
          nome: string
          ruolo: 'P' | 'D' | 'C' | 'A'
          squadra: string
          player_id?: number | null
          is_assigned?: boolean
          assigned_to?: string | null
          purchase_price?: number
          created_at?: string
        }
        Update: {
          id?: string
          room_id?: string
          nome?: string
          ruolo?: 'P' | 'D' | 'C' | 'A'
          squadra?: string
          player_id?: number | null
          is_assigned?: boolean
          assigned_to?: string | null
          purchase_price?: number
          created_at?: string
        }
      }
      bids: {
        Row: {
          id: string
          room_id: string
          player_id: string
          participant_id: string
          amount: number
          created_at: string
        }
        Insert: {
          id?: string
          room_id: string
          player_id: string
          participant_id: string
          amount: number
          created_at?: string
        }
        Update: {
          id?: string
          room_id?: string
          player_id?: string
          participant_id?: string
          amount?: number
          created_at?: string
        }
      }
      auction_timers: {
        Row: {
          id: string
          room_id: string
          player_id: string
          start_time: string
          end_time: string
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          room_id: string
          player_id: string
          start_time: string
          end_time: string
          is_active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          room_id?: string
          player_id?: string
          start_time?: string
          end_time?: string
          is_active?: boolean
          created_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}