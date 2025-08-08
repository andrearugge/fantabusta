import { Database } from '@/lib/supabase/database.types'

export type Room = Database['public']['Tables']['rooms']['Row']
export type Participant = Database['public']['Tables']['participants']['Row']
export type Player = Database['public']['Tables']['players']['Row']
export type Bid = Database['public']['Tables']['bids']['Row']

export type RoomInsert = Database['public']['Tables']['rooms']['Insert']
export type ParticipantInsert = Database['public']['Tables']['participants']['Insert']
export type PlayerInsert = Database['public']['Tables']['players']['Insert']
export type BidInsert = Database['public']['Tables']['bids']['Insert']

export interface PlayerWithBids extends Player {
  bids?: Bid[]
}

export interface ParticipantWithPlayers extends Participant {
  players?: Player[]
}

export interface AuctionState {
  currentPlayer?: Player | null
  timeRemaining: number
  isActive: boolean
  currentTurn: number
  lastResult?: {
    player: Player
    winner: {
      display_name: string
      participant_id: string
    } | null
    winningBid: number
    allBids: {
      participant_name: string
      amount: number
    }[]
  }
}

export interface CSVPlayer {
  nome: string
  ruolo: 'P' | 'D' | 'C' | 'A'
  squadra: string
}