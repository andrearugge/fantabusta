'use client'

import { useEffect, useState } from 'react'
import { Progress } from '@/components/ui/progress'
import { createClient } from '@/lib/supabase/client'

interface AuctionTimerProps {
  initialTime: number
  isActive: boolean
  onTimeUp: () => void
  roomId: string
}

export function AuctionTimer({ initialTime, isActive, onTimeUp, roomId }: AuctionTimerProps) {
  const [timeRemaining, setTimeRemaining] = useState(initialTime)
  const supabase = createClient()

  useEffect(() => {
    setTimeRemaining(initialTime)
  }, [initialTime])

  useEffect(() => {
    if (!isActive) return

    const interval = setInterval(() => {
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
  }, [isActive, onTimeUp])

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