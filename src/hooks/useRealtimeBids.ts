import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface BidUpdate {
  participant_name: string
  amount: number
  timestamp: string
}

export function useRealtimeBids(playerId: string | null) {
  const [bids, setBids] = useState<BidUpdate[]>([])
  const supabase = createClient()

  useEffect(() => {
    if (!playerId) {
      setBids([])
      return
    }

    const channel = supabase
      .channel('bid_updates')
      .on('broadcast', { event: 'bid_placed' }, (payload) => {
        if (payload.payload.player_id === playerId) {
          setBids(prev => [
            ...prev.filter(bid => bid.participant_name !== payload.payload.participant_name),
            {
              participant_name: payload.payload.participant_name,
              amount: payload.payload.amount,
              timestamp: new Date().toISOString()
            }
          ].sort((a, b) => b.amount - a.amount))
        }
      })
      .on('broadcast', { event: 'auction_closed' }, () => {
        setBids([])
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [playerId])

  return bids
}