'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Search, Play, SkipForward, Users, Clock, Home, ChevronRight, Settings } from 'lucide-react'
import { Room, Participant, Player } from '@/types'
import Link from 'next/link'
import { AuctionTimer } from './AuctionTimer'

interface AuctionAdminProps {
  room: Room
  participants: Participant[]
  players: Player[]
  assignedPlayers: any[]
}

export default function AuctionAdmin({
  room,
  participants,
  players,
  assignedPlayers
}: AuctionAdminProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [currentTurn, setCurrentTurn] = useState(0)
  const [timeRemaining, setTimeRemaining] = useState(0)
  const [isAuctionActive, setIsAuctionActive] = useState(false)
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null)
  // Aggiungi stato locale per i giocatori
  const [localPlayers, setLocalPlayers] = useState<Player[]>(players)
  const [localAssignedPlayers, setLocalAssignedPlayers] = useState(assignedPlayers)

  const supabase = createClient()

  // Aggiorna i giocatori disponibili basandosi sullo stato locale
  const availablePlayers = localPlayers.filter(p => !p.is_assigned)
  const filteredPlayers = availablePlayers.filter(p =>
    p.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.squadra.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const currentParticipant = participants[currentTurn]

  // Subscription realtime per aggiornamenti asta
  useEffect(() => {
    const channel = supabase
      .channel('auction_events')
      .on('broadcast', { event: 'auction_closed' }, (payload) => {
        const { player, winner, winningBid } = payload.payload
        
        if (player && winner) {
          // Aggiorna lo stato locale dei giocatori
          setLocalPlayers(prev => 
            prev.map(p => 
              p.id === player.id 
                ? { ...p, is_assigned: true, assigned_to: winner.participant_id }
                : p
            )
          )
          
          // Aggiorna la lista dei giocatori assegnati con il valore di acquisto
          setLocalAssignedPlayers(prev => [
            {
              ...player,
              is_assigned: true,
              assigned_to: winner.participant_id,
              participants: { display_name: winner.display_name },
              purchase_price: winningBid // Aggiungi il valore di acquisto
            },
            ...prev
          ])
        }
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [room.id])

  // Aggiorna la funzione getParticipantStats per usare localAssignedPlayers
  const getParticipantStats = (participant: Participant) => {
    const playersByRole = localAssignedPlayers.filter(p => p.assigned_to === participant.id)
    return {
      P: playersByRole.filter(p => p.ruolo === 'P').length,
      D: playersByRole.filter(p => p.ruolo === 'D').length,
      C: playersByRole.filter(p => p.ruolo === 'C').length,
      A: playersByRole.filter(p => p.ruolo === 'A').length,
      total: playersByRole.length
    }
  }

  // Timer countdown
  // Aggiungi subscription per timer updates
  useEffect(() => {
    const channel = supabase
      .channel('auction_events')
      .on('broadcast', { event: 'timer_update' }, (payload) => {
        setTimeRemaining(payload.payload.timeRemaining)
      })
      .on('broadcast', { event: 'auction_closed' }, (payload) => {
        // Gestisci chiusura asta
        setIsAuctionActive(false)
        setSelectedPlayer(null)
        setTimeRemaining(0)
        
        // Aggiorna liste locali
        const { player, winner, winningBid } = payload.payload
        if (winner) {
          setLocalAssignedPlayers(prev => [{
            ...player, 
            assigned_to: winner.participant_id,
            purchase_price: winningBid
          }, ...prev])
          setLocalPlayers(prev => prev.filter(p => p.id !== player.id))
        }
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, []) // ← Cambiato da [room.id] a [] per evitare re-subscription

  const startAuction = async (player: Player) => {
    setSelectedPlayer(player)
    setIsAuctionActive(true)

    await fetch('/api/auction/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        roomId: room.id,
        playerId: player.id,
        currentTurn
      })
    })
  }

  const handleCloseAuction = async () => {
    if (!selectedPlayer) return

    setIsAuctionActive(false)

    await fetch('/api/auction/close', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        roomId: room.id,
        playerId: selectedPlayer.id
      })
    })

    // Passa al turno successivo
    setCurrentTurn((currentTurn + 1) % participants.length)
    setSelectedPlayer(null)
  }

  const skipTurn = () => {
    setCurrentTurn((currentTurn + 1) % participants.length)
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumbs */}
      <nav className="flex items-center space-x-2 text-sm text-gray-600">
        <Link href="/" className="flex items-center hover:text-gray-900 transition-colors">
          <Home className="h-4 w-4 mr-1" />
          Homepage
        </Link>
        <ChevronRight className="h-4 w-4" />
        <span className="text-gray-900 font-medium">Asta {room.code}</span>
        <ChevronRight className="h-4 w-4" />
        <Link href={`/room-settings?code=${room.code}`} className="flex items-center hover:text-gray-900 transition-colors">
          <Settings className="h-4 w-4 mr-1" />
          Impostazioni
        </Link>
      </nav>

      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-black">Asta {room.code}</h1>
          <p className="text-gray-600">Status: {room.status}</p>
        </div>
        <div className="text-right">
          <p className="text-sm text-gray-600">Turno di:</p>
          <p className="text-lg font-semibold">{currentParticipant?.display_name}</p>
        </div>
      </div>

      {/* Timer e controlli */}
      {isAuctionActive && selectedPlayer && (
        <Card className="border-2 border-red-500">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Asta in corso: {selectedPlayer.nome}
            </CardTitle>
            <CardDescription>
              {selectedPlayer.ruolo} - {selectedPlayer.squadra}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <AuctionTimer
                initialTime={30}
                isActive={isAuctionActive}
                onTimeUp={handleCloseAuction}
                roomId={room.id}
                playerId={selectedPlayer.id}
              />
              <Button
                onClick={handleCloseAuction}
                variant="destructive"
                className="w-full"
              >
                Chiudi Asta
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Selezione giocatore */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Search className="h-5 w-5" />
                Seleziona Calciatore
              </CardTitle>
              <CardDescription>
                {availablePlayers.length} calciatori disponibili
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input
                placeholder="Cerca per nome o squadra..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />

              <div className="max-h-96 overflow-y-auto space-y-2">
                {filteredPlayers.map((player) => (
                  <div
                    key={player.id}
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50"
                  >
                    <div>
                      <p className="font-medium">{player.nome}</p>
                      <p className="text-sm text-gray-600">
                        <Badge variant="outline" className="mr-2">
                          {player.ruolo}
                        </Badge>
                        {player.squadra}
                      </p>
                    </div>
                    <Button
                      onClick={() => startAuction(player)}
                      disabled={isAuctionActive}
                      size="sm"
                    >
                      <Play className="h-4 w-4 mr-1" />
                      Avvia
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Squadre */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Squadre
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button
                onClick={skipTurn}
                variant="outline"
                className="w-full"
                disabled={isAuctionActive}
              >
                <SkipForward className="h-4 w-4 mr-1" />
                Salta Turno
              </Button>
              {participants.map((participant, index) => {
                const stats = getParticipantStats(participant)
                const isCurrentTurn = index === currentTurn

                return (
                  <div
                    key={participant.id}
                    className={`p-3 border rounded-lg ${isCurrentTurn ? 'border-blue-500 bg-blue-50' : ''
                      }`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <p className="font-medium">{participant.display_name}</p>
                      <Badge variant={isCurrentTurn ? 'default' : 'secondary'}>
                        {stats.total}/25
                      </Badge>
                    </div>

                    <div className="text-sm text-gray-600 space-y-1">
                      <p>Budget: {participant.budget}M</p>
                      <div className="flex gap-2">
                        <span>P: {stats.P}/3</span>
                        <span>D: {stats.D}/8</span>
                        <span>C: {stats.C}/8</span>
                        <span>A: {stats.A}/6</span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Log estrazioni - aggiorna per usare localAssignedPlayers */}
      <Card>
        <CardHeader>
          <CardTitle>Ultime Estrazioni</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {localAssignedPlayers.slice(0, 10).map((player, index) => (
              <div key={`${player.id}-${index}`} className="flex justify-between items-center p-2 border-b">
                <div className="flex-1">
                  <span className="font-medium">{player.nome}</span>
                  <Badge variant="outline" className="ml-2">{player.ruolo}</Badge>
                  <span className="text-sm text-gray-600 ml-2">{player.squadra}</span>
                </div>
                <div className="text-right">
                  <p className="font-medium">{player.participants?.display_name}</p>
                  {player.purchase_price && (
                    <p className="text-sm text-green-600 font-semibold">
                      {player.purchase_price}M
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
