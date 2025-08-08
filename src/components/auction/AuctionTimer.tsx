'use client'

import { useEffect, useState } from 'react'
import { Progress } from '@/components/ui/progress'
import { createClient } from '@/lib/supabase/client'

interface AuctionTimerProps {
  initialTime: number
  isActive: boolean
  onTimeUp: () => void
  roomId: string
  playerId: string
}

export function AuctionTimer({ initialTime, isActive, onTimeUp, roomId, playerId }: AuctionTimerProps) {
  const [timeRemaining, setTimeRemaining] = useState(initialTime)
  const [timerId, setTimerId] = useState<string | null>(null)
  const supabase = createClient()

  // Sincronizza con database all'avvio
  useEffect(() => {
    if (!isActive || !playerId) return

    const syncWithDatabase = async () => {
      const { data: timer } = await supabase
        .from('auction_timers')
        .select('*')
        .eq('room_id', roomId)
        .eq('player_id', playerId)
        .eq('is_active', true)
        .single()

      if (timer) {
        setTimerId(timer.id)
        const now = new Date()
        const endTime = new Date(timer.end_time)
        const remaining = Math.max(0, Math.ceil((endTime.getTime() - now.getTime()) / 1000))
        setTimeRemaining(remaining)
        
        if (remaining <= 0) {
          onTimeUp()
        }
      }
    }

    syncWithDatabase()
  }, [isActive, playerId, roomId])

  // Timer locale con sincronizzazione periodica
  useEffect(() => {
    if (!isActive || !timerId) return

    const interval = setInterval(async () => {
      // Verifica stato nel database ogni 5 secondi
      if (timeRemaining % 5 === 0) {
        const { data: timer } = await supabase
          .from('auction_timers')
          .select('*')
          .eq('id', timerId)
          .single()

        if (!timer?.is_active) {
          setTimeRemaining(0)
          onTimeUp()
          return
        }
      }

      setTimeRemaining(prev => {
        const newTime = prev - 1
        
        // Broadcast timer update
        supabase
          .channel('auction_events')
          .send({
            type: 'broadcast',
            event: 'timer_update',
            payload: { timeRemaining: newTime }
          })

        if (newTime <= 0) {
          onTimeUp()
          return 0
        }
        return newTime
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [isActive, timerId, timeRemaining])

  const progressValue = (timeRemaining / initialTime) * 100
  const isUrgent = timeRemaining <= 10

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <span className="text-sm font-medium">Tempo rimanente</span>
        <span className={`text-lg font-bold ${
          isUrgent ? 'text-red-500' : 'text-blue-600'
        }`}>
          {timeRemaining}s
        </span>
      </div>
      <Progress 
        value={progressValue} 
        className={`h-3 ${
          isUrgent ? 'bg-red-100' : 'bg-blue-100'
        }`}
      />
    </div>
  )
}