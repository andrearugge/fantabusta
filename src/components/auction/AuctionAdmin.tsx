'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { SkipForward, Users, Clock, Home, ChevronRight, Settings, Trophy } from 'lucide-react'
import { Room, Participant, Player } from '@/types'
import Link from 'next/link'
import { AuctionTimer } from './AuctionTimer'

interface AuctionAdminProps {
  room: Room
  participants: Participant[]
  players: Player[]
}

// Componente separato per le card dei partecipanti
interface ParticipantCardProps {
  participant: Participant
  currentTurn: number
  roomId: string
}

function ParticipantCard({ participant, currentTurn, roomId }: ParticipantCardProps) {
  const [stats, setStats] = useState({ P: 0, D: 0, C: 0, A: 0, total: 0 })
  const supabase = createClient()
  const isCurrentTurn = participant.turn_order === currentTurn

  const fetchStats = useCallback(async () => {
    try {
      const { data: playersByRole, error } = await supabase
        .from('players')
        .select('ruolo')
        .eq('room_id', roomId)
        .eq('assigned_to', participant.id)
        .eq('is_assigned', true)

      if (error) {
        console.error('Errore recupero statistiche:', error)
        return
      }

      const newStats = {
        P: playersByRole?.filter(p => p.ruolo === 'P').length || 0,
        D: playersByRole?.filter(p => p.ruolo === 'D').length || 0,
        C: playersByRole?.filter(p => p.ruolo === 'C').length || 0,
        A: playersByRole?.filter(p => p.ruolo === 'A').length || 0,
        total: playersByRole?.length || 0
      }

      setStats(newStats)
    } catch (error) {
      console.error('Errore calcolo statistiche:', error)
    }
  }, [supabase, roomId, participant.id])

  useEffect(() => {
    fetchStats()
  }, [fetchStats])

  // Aggiorna le statistiche quando cambia il partecipante
  useEffect(() => {
    fetchStats()
  }, [participant.budget, fetchStats])

  return (
    <div
      className={`p-3 border rounded-lg ${
        isCurrentTurn ? 'border-blue-500 bg-blue-50' : 'bg-white'
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
}

export default function AuctionAdmin({
  room,
  participants: initialParticipants,
  players
}: AuctionAdminProps) {
  // Inizializzazione Supabase
  const supabase = createClient()

  // Stati del componente
  const [participants, setParticipants] = useState<Participant[]>(initialParticipants)
  const [currentTurn, setCurrentTurn] = useState(0)
  const [timeRemaining, setTimeRemaining] = useState(0)
  const [isAuctionActive, setIsAuctionActive] = useState(false)
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null)

  // Funzione per caricare tutti i dati dal database
  const loadDataFromDatabase = useCallback(async () => {
    try {
      // Carica room data per ottenere il currentTurn
      const { data: roomData, error: roomError } = await supabase
        .from('rooms')
        .select('current_turn')
        .eq('id', room.id)
        .single()

      if (roomError) {
        console.error('Errore recupero room:', roomError)
      }

      // Carica partecipanti ordinati per turn_order
      const { data: participantsData, error: participantsError } = await supabase
        .from('participants')
        .select('*')
        .eq('room_id', room.id)
        .order('turn_order', { ascending: true })

      if (participantsError) {
        console.error('Errore recupero partecipanti:', participantsError)
      } else {
        setParticipants(participantsData || [])
      }

      // Imposta il currentTurn dal database
      if (roomData) {
        setCurrentTurn(roomData.current_turn || 0)
      }
    } catch (error) {
      console.error('Errore caricamento dati:', error)
    }
  }, [supabase, room.id])

  // Carica i dati all'avvio del componente
  useEffect(() => {
    loadDataFromDatabase()
  }, [loadDataFromDatabase])

  // Funzione per aggiornare il turno nel database
  const updateTurnInDatabase = useCallback(async (newTurn: number) => {
    try {
      const { error } = await supabase
        .from('rooms')
        .update({ current_turn: newTurn })
        .eq('id', room.id)

      if (error) {
        console.error('Errore aggiornamento turno:', error)
        return false
      }

      return true
    } catch (error) {
      console.error('Errore update turno:', error)
      return false
    }
  }, [supabase, room.id])

  // Funzione per chiudere l'asta
  const handleCloseAuction = useCallback(async () => {
    if (!selectedPlayer) return

    setIsAuctionActive(false)

    try {
      await fetch('/api/auction/close', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId: room.id,
          playerId: selectedPlayer.id
        })
      })

      // Calcola il nuovo turno
      const newTurn = (currentTurn + 1) % participants.length

      // Aggiorna il turno nel database
      const success = await updateTurnInDatabase(newTurn)

      if (success) {
        setCurrentTurn(newTurn)
        setSelectedPlayer(null)

        // Broadcast del cambio turno
        await supabase
          .channel('auction_events')
          .send({
            type: 'broadcast',
            event: 'turn_changed',
            payload: {
              newTurn,
              currentParticipant: participants[newTurn]
            }
          })

        await loadDataFromDatabase()
      }
    } catch (error) {
      console.error('Errore chiusura asta:', error)
    }
  }, [selectedPlayer, room.id, currentTurn, participants, supabase, updateTurnInDatabase, loadDataFromDatabase])

  // Funzione per saltare il turno
  const skipTurn = useCallback(async () => {
    const newTurn = (currentTurn + 1) % participants.length

    const success = await updateTurnInDatabase(newTurn)

    if (success) {
      setCurrentTurn(newTurn)

      try {
        // Broadcast del cambio turno
        await supabase
          .channel('auction_events')
          .send({
            type: 'broadcast',
            event: 'turn_changed',
            payload: {
              newTurn,
              currentParticipant: participants[newTurn]
            }
          })
      } catch (error) {
        console.error('Errore skip turno:', error)
      }
    }
  }, [currentTurn, participants, supabase, updateTurnInDatabase])

  // Gestione eventi realtime
  useEffect(() => {
    const channel = supabase
      .channel('auction_events')
      .on('broadcast', { event: 'timer_update' }, (payload) => {
        setTimeRemaining(payload.payload.timeRemaining)
      })
      .on('broadcast', { event: 'turn_changed' }, (payload) => {
        setCurrentTurn(payload.payload.newTurn)
      })
      .on('broadcast', { event: 'auction_closed' }, async (payload) => {
        setIsAuctionActive(false)
        setSelectedPlayer(null)
        setTimeRemaining(0)
        await loadDataFromDatabase()
      })
      .on('broadcast', { event: 'player_selected' }, (payload) => {
        // Quando un partecipante seleziona un giocatore
        setSelectedPlayer(payload.payload.player)
        setIsAuctionActive(true)
        setTimeRemaining(payload.payload.duration || 30)
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [room.id, supabase, loadDataFromDatabase])

  return (
    <div className="lg:h-[90vh] lg:overflow-y">
      <div className="grid grid-cols-5 h-full">
        <div className="lg:col-span-3 col-span-5">
          <div className="container-fluid mx-auto px-4 lg:pr-8 py-8 space-y-6">
            <div className="grid grid-cols-2 items-center space-y-2">
              <div className="lg:col-span-1 col-span-2">
                <div className="text-lg font-bold flex items-center gap-2">
                  <Settings className="h-5 w-5" /> Admin asta
                </div>
              </div>
              <div className="lg:col-span-1 col-span-2 flex lg:justify-end">
                <nav className="flex items-center space-x-2 text-sm text-gray-600">
                  <Link href="/" className="flex items-center hover:text-gray-900 transition-colors">
                    <Home className="h-4 w-4 mr-1" />
                    Homepage
                  </Link>
                  <ChevronRight className="h-4 w-4" />
                  <Trophy className="h-4 w-4 mr-1" /> <span className="text-gray-900 font-medium">Asta</span>
                </nav>
              </div>
            </div>

            {/* Timer e controlli asta attiva */}
            {isAuctionActive && selectedPlayer && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5" />
                    Asta in corso
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="p-2 border border-blue-500 rounded-sm bg-blue-50 text-blue-600 text-center font-medium">
                      {selectedPlayer.nome} - {selectedPlayer.ruolo} - {selectedPlayer.squadra}
                    </div>
                    <AuctionTimer
                      initialTime={parseInt(process.env.NEXT_PUBLIC_TIMER || '30')}
                      isActive={isAuctionActive}
                      onTimeUp={handleCloseAuction}
                      roomId={room.id}
                      playerId={selectedPlayer.id}
                    />
                    <Button
                      onClick={handleCloseAuction}
                      variant="outline"
                      className="w-full"
                    >
                      Chiudi Asta
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Messaggio informativo quando nessuna asta è attiva */}
            {!isAuctionActive && (
              <Card>
                <CardHeader>
                  <CardTitle>Controllo Asta</CardTitle>
                  <CardDescription>
                    L'asta è gestita dai partecipanti. Il partecipante di turno può selezionare un calciatore dal proprio portale.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-4">
                    <p className="text-gray-600">
                      Turno corrente: <span className="font-medium">
                        {participants[currentTurn]?.display_name || 'Caricamento...'}
                      </span>
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
        
        <div className="lg:col-span-2 col-span-5 space-y-6 px-4 lg:pl-8 py-8 border-l border-gray-200">
          {/* Squadre */}
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-1">
              <div className="text-lg font-bold flex items-center gap-2">
                <Users className="h-5 w-5" /> Squadre
              </div>
            </div>
            <div className="col-span-1 justify-end flex items-center gap-2">
              <Link href={`/room-settings?code=${room.code}`}>
                <Button variant="outline" size="sm" className="cursor-pointer px-3">
                  Impostazioni
                </Button>
              </Link>
              <Link href={`/teams/${room.code}`}>
                <Button variant="outline" size="sm" className="cursor-pointer px-3">
                  Formazioni
                </Button>
              </Link>
            </div>
          </div>

          <Button
            onClick={skipTurn}
            variant="outline"
            className="w-full"
            disabled={isAuctionActive}
          >
            <SkipForward className="h-4 w-4 mr-1" />
            Salta Turno
          </Button>

          <div className="grid gap-2 lg:grid-cols-2">
            {participants.map((participant) => (
              <ParticipantCard
                key={participant.id}
                participant={participant}
                currentTurn={currentTurn}
                roomId={room.id}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}