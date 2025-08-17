'use client'

import { useEffect, useState, useCallback } from 'react'
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

  // Usa useCallback per evitare dipendenze circolari
  const handleTimeUp = useCallback(() => {
    // Avvolgi in setTimeout per evitare aggiornamenti durante il rendering
    setTimeout(() => {
      onTimeUp()
    }, 0)
  }, [onTimeUp])

  // Sincronizza con database all'avvio
  useEffect(() => {
    if (!isActive || !playerId) return

    const syncWithDatabase = async () => {
      const { data: timers, error } = await supabase
        .from('auction_timers')
        .select('*')
        .eq('room_id', roomId)
        .eq('player_id', playerId)
        .eq('is_active', true)
        .order('created_at', { ascending: false }) // Prendi il più recente
        .limit(1)
      
      if (error) {
        console.error('❌ Errore recupero timer:', error)
        return
      }
      
      const timer = timers?.[0] // Prendi il primo risultato
      if (timer) {
        setTimerId(timer.id)
        const now = new Date()
        const endTime = new Date(timer.end_time)
        const remaining = Math.max(0, Math.ceil((endTime.getTime() - now.getTime()) / 1000))
        setTimeRemaining(remaining)
        
        if (remaining <= 0) {
          setTimeout(() => {
            handleTimeUp()
          }, 0)
        }
      }
    }

    syncWithDatabase()
  }, [isActive, playerId, roomId, supabase, handleTimeUp])

  // Timer locale con sincronizzazione periodica
  useEffect(() => {
    if (!isActive || !timerId) return

    const interval = setInterval(async () => {
      setTimeRemaining(prev => {
        const newTime = prev - 1
        
        // Verifica stato nel database ogni 5 secondi
        if (newTime % 5 === 0 && newTime > 0) {
          supabase
            .from('auction_timers')
            .select('*')
            .eq('id', timerId)
            .single()
            .then(({ data: timer }) => {
              if (!timer?.is_active) {
                setTimeRemaining(0)
                setTimeout(() => {
                  handleTimeUp()
                }, 0)
              }
            })
          
          // RIMUOVI QUESTA CHIAMATA AUTOMATICA - È TROPPO AGGRESSIVA
          // fetch('/api/auction/check-timers', { method: 'POST' })
          //   .catch(err => console.error('Errore check-timers:', err))
        }
        
        // Broadcast timer update
        supabase
          .channel('auction_events')
          .send({
            type: 'broadcast',
            event: 'timer_update',
            payload: { timeRemaining: newTime }
          })
          .catch(err => console.error('Errore broadcast:', err))

        if (newTime <= 0) {
          setTimeout(() => {
            handleTimeUp()
          }, 0)
          return 0
        }
        return newTime
      })
    }, 1000)

    return () => {
      clearInterval(interval)
    }
  }, [isActive, timerId, supabase, handleTimeUp])

  const progressValue = (timeRemaining / initialTime) * 100

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <span className="text-sm font-medium">Tempo rimanente</span>
        <span className="text-lg font-bold text-success-600">
          {timeRemaining}s
        </span>
      </div>
      <Progress 
        value={progressValue} 
        className="h-3 bg-gray-100"
      />
    </div>
  )
}