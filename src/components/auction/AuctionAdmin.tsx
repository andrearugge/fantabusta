'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Clock, Home, ChevronRight, Trophy, Download, UserPlus } from 'lucide-react'
import { Room, Participant, Player } from '@/types'
import Link from 'next/link'
import { AuctionTimer } from './AuctionTimer'
import TurnManagement from './TurnManagement'
import TeamsList from './TeamsList'
import { Button } from '../ui/button'

interface AuctionAdminProps {
  room: Room
  participants: Participant[]
  players: Player[]
}

export default function AuctionAdmin({
  room,
  participants: initialParticipants,
  players
}: AuctionAdminProps) {
  const [currentTurn, setCurrentTurn] = useState(room.current_turn ?? 0)  // Corretto da || 1 a ?? 0
  const [participants, setParticipants] = useState<Participant[]>(initialParticipants)
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null)
  const [auctionTimer, setAuctionTimer] = useState<{
    initialTime: number
    isActive: boolean
    playerId: number
  } | null>(null)
  const [isAuctionActive, setIsAuctionActive] = useState(false)

  const supabase = createClient()

  // Sottoscrizione agli eventi real-time
  useEffect(() => {
    const channel = supabase
      .channel(`room-${room.id}`)
      .on('broadcast', { event: 'turn_changed' }, (payload) => {
        setCurrentTurn(payload.payload.newTurn)
      })
      .on('broadcast', { event: 'player_selected' }, (payload) => {
        const playerData = payload.payload.player
        setSelectedPlayer(playerData)

        // Calcola il tempo rimanente dall'end_time
        const endTime = new Date(payload.payload.end_time)
        const now = new Date()
        const timeRemaining = Math.max(0, Math.floor((endTime.getTime() - now.getTime()) / 1000))

        setAuctionTimer({
          initialTime: timeRemaining,
          isActive: true,
          playerId: playerData.id
        })
        setIsAuctionActive(true)
      })
      .on('broadcast', { event: 'auction_closed' }, () => {
        setSelectedPlayer(null)
        setAuctionTimer(null)
        setIsAuctionActive(false)
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [room.id, supabase])

  // Aggiorna i partecipanti quando cambiano
  useEffect(() => {
    const fetchParticipants = async () => {
      const { data } = await supabase
        .from('participants')
        .select('*')
        .eq('room_id', room.id)
        .order('turn_order')

      if (data) {
        setParticipants(data)
      }
    }

    fetchParticipants()
  }, [room.id, supabase])

  const closeAuction = useCallback(async () => {
    if (!selectedPlayer) return

    try {
      const response = await fetch('/api/auction/close', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          room_id: room.id,
          player_id: selectedPlayer.id
        })
      })

      if (!response.ok) {
        throw new Error('Errore nella chiusura dell\'asta')
      }

      setSelectedPlayer(null)
      setAuctionTimer(null)
      setIsAuctionActive(false)
    } catch (error) {
      console.error('Errore nella chiusura dell\'asta:', error)
    }
  }, [selectedPlayer, room.id])

  const handleTurnSkipped = () => {
    // Callback per quando il turno viene saltato
    // Può essere usato per aggiornamenti aggiuntivi se necessario
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container-fluid mx-auto px-4 py-8">

        {/* Breadcrumbs */}
        <nav className="flex items-center space-x-2 text-sm text-gray-600 mb-2">
          <Link href="/" className="flex items-center hover:text-gray-900 transition-colors">
            <Home className="h-4 w-4 mr-1" />
            Homepage
          </Link>
          <ChevronRight className="h-4 w-4" />
          <span className="text-gray-900 font-medium flex items-center">
            <Trophy className="h-4 w-4 mr-1" />
            Asta {room.code}
          </span>
        </nav>

        {/* Header */}
        <div className="mb-8 flex justify-between items-center">
          <h1 className="text-3xl font-bold text-black">Amministrazione Asta</h1>
          <div className="flex items-center gap-2">
            <Link href={`/room-settings?code=${room.code}`}>
              <Button variant="outline" className="cursor-pointer px-3">
                Impostazioni
              </Button>
            </Link>
          </div>
        </div>

        <div className="">
          {/* Colonna destra - Gestione turni */}
          <div className="space-y-6">
            <TurnManagement
              room={room}
              participants={participants}
              currentTurn={currentTurn}
              isAuctionActive={isAuctionActive}
              onTurnSkipped={handleTurnSkipped}
            />
          </div>
        </div>

        {/* Sezione Formazioni */}
        <div className="mt-12">
          <TeamsList
            room={room}
            participants={participants}
          />
        </div>
      </div>
    </div>
  )
}