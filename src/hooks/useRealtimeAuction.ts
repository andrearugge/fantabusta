import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { AuctionState } from '@/types'

interface RealtimeAuctionHook {
  currentAuction: AuctionState | null
  isConnected: boolean
}

export function useRealtimeAuction(roomId: string): RealtimeAuctionHook {
  const [currentAuction, setCurrentAuction] = useState<AuctionState | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    const channel = supabase
      .channel('auction_events')
      .on('broadcast', { event: 'player_selected' }, (payload) => {
        setCurrentAuction({
          isActive: true,
          currentPlayer: payload.payload.player,
          timeRemaining: payload.payload.timeLimit || 60,
          currentTurn: payload.payload.currentTurn || 0
        })
      })
      .on('broadcast', { event: 'auction_closed' }, (payload) => {
        setCurrentAuction({
          isActive: false,
          currentPlayer: null,
          timeRemaining: 0,
          currentTurn: 0,
          lastResult: {
            player: payload.payload.player,
            winner: payload.payload.winner,
            winningBid: payload.payload.winningBid,
            allBids: payload.payload.allBids
          }
        })
      })
      .on('broadcast', { event: 'timer_update' }, (payload) => {
        setCurrentAuction(prev => prev ? {
          ...prev,
          timeRemaining: payload.payload.timeRemaining
        } : null)
      })
      .subscribe((status) => {
        setIsConnected(status === 'SUBSCRIBED')
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [roomId])

  return { currentAuction, isConnected }
}