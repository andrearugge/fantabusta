'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { SkipForward, Users } from 'lucide-react'
import { Room, Participant } from '@/types'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

interface TurnManagementProps {
  room: Room
  participants: Participant[]
  currentTurn: number
  isAuctionActive: boolean
  onTurnSkipped?: () => void
}

interface ParticipantCardProps {
  participant: Participant
  currentTurn: number
  roomId: string
  playersCount: number
  totalSpent: number
}

function ParticipantCard({ participant, currentTurn, roomId, playersCount, totalSpent }: ParticipantCardProps) {
  const isCurrentTurn = participant.turn_order === currentTurn
  
  return (
    <Card className={`py-3 ${
      isCurrentTurn 
        ? 'ring-1 ring-blue-500 bg-blue-50 border-blue-200' 
        : ''
    }`}>
      <CardHeader className="">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">
            {participant.display_name}
          </CardTitle>
        </div>
        <CardDescription className="flex items-center justify-between">
          <span className="font-medium text-green-600">
            <Badge variant="outline">
                  {totalSpent} / {participant.budget}M
                </Badge>
          </span>
        </CardDescription>
      </CardHeader>
    </Card>
  )
}

export default function TurnManagement({ 
  room, 
  participants, 
  currentTurn, 
  isAuctionActive,
  onTurnSkipped 
}: TurnManagementProps) {
  const [participantStats, setParticipantStats] = useState<Record<string, { playersCount: number; totalSpent: number }>>({})
  const [isSkipping, setIsSkipping] = useState(false)
  const supabase = createClient()

  // Carica statistiche partecipanti
  useEffect(() => {
    const fetchParticipantStats = async () => {
      const stats: Record<string, { playersCount: number; totalSpent: number }> = {}
      
      for (const participant of participants) {
        const { data: players } = await supabase
          .from('players')
          .select('purchase_price')
          .eq('room_id', room.id)
          .eq('assigned_to', participant.id)
          .eq('is_assigned', true)

        const playersCount = players?.length || 0
        const totalSpent = players?.reduce((sum, player) => sum + (player.purchase_price || 0), 0) || 0
        
        stats[participant.id] = { playersCount, totalSpent }
      }
      
      setParticipantStats(stats)
    }

    fetchParticipantStats()

    // Sottoscrizione per aggiornamenti real-time
    const channel = supabase
      .channel(`room-${room.id}-participants`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'players',
        filter: `room_id=eq.${room.id}`
      }, () => {
        fetchParticipantStats()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [room.id, participants, supabase])

  const skipTurn = async () => {
    if (isSkipping) return
    
    setIsSkipping(true)
    
    try {
      const response = await fetch('/api/rooms/skip-turn', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          room_id: room.id
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Errore nel saltare il turno')
      }

      const result = await response.json()
      console.log('Turno saltato con successo:', result)
      
      onTurnSkipped?.()
    } catch (error) {
      console.error('Errore nel saltare il turno:', error)
      // Potresti aggiungere qui una notifica di errore per l'utente
    } finally {
      setIsSkipping(false)
    }
  }

  return (
    <div className="space-y-2">
      {/* Header Squadre */}
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-1">
          <div className="text-lg font-bold flex items-center gap-2">
            <Users className="h-5 w-5" /> Turni
          </div>
        </div>
      </div>

      {/* Pulsante Salta Turno */}
      <Button
        onClick={skipTurn}
        variant="outline"
        className="w-full"
        disabled={isAuctionActive || isSkipping}
      >
        <SkipForward className="h-4 w-4 mr-1" />
        {isSkipping ? 'Saltando...' : 'Salta Turno'}
      </Button>

      {/* Lista Partecipanti */}
      <div className="grid gap-2 lg:grid-cols-8 grid-cols-2">
        {participants.map((participant) => {
          const stats = participantStats[participant.id] || { playersCount: 0, totalSpent: 0 }
          return (
            <ParticipantCard
              key={participant.id}
              participant={participant}
              currentTurn={currentTurn}
              roomId={room.id}
              playersCount={stats.playersCount}
              totalSpent={stats.totalSpent}
            />
          )
        })}
      </div>
    </div>
  )
}