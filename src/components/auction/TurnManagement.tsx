'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { SkipForward, CircleArrowRight } from 'lucide-react'
import { Room, Participant } from '@/types'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { getBaseUrl } from '@/lib/utils/url'

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
  room: Room
}

function ParticipantCard({ participant, currentTurn, totalSpent, room }: ParticipantCardProps) {
  return (
    <Card className={`${participant.turn_order === currentTurn
      ? 'border-2 border-blue-500'
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
              {totalSpent} / {room.budget_default}M
            </Badge>
          </span>
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button
          size="sm"
          variant="outline"
          onClick={() => window.open(`${getBaseUrl()}/p/${participant.join_url}`, '_blank')}
          className="w-full"
        >
          Pagina asta <CircleArrowRight className="h-4 w-4" />
        </Button>
      </CardContent>
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

      {/* Header */}
      <div className="flex space-y-1 flex-col lg:flex-row lg:justify-between lg:items-center">
        <div>
          <p className="text-xl font-bold text-black">Turni</p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={skipTurn}
            variant="outline"
            disabled={isAuctionActive || isSkipping}
          >
            <SkipForward className="h-4 w-4 mr-1" />
            {isSkipping ? 'Saltando...' : 'Salta Turno'}
          </Button>
        </div>
      </div>

      {/* Pulsante Salta Turno */}


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
              room={room}
            />
          )
        })}
      </div>
    </div>
  )
}