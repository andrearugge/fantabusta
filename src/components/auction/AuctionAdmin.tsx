'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Search, Play, SkipForward, Users, Clock, Home, ChevronRight, Settings } from 'lucide-react'
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
  index: number
  currentTurn: number
  roomId: string
}

function ParticipantCard({ participant, index, currentTurn, roomId }: ParticipantCardProps) {
  const [stats, setStats] = useState({ P: 0, D: 0, C: 0, A: 0, total: 0 })
  const supabase = createClient()
  const isCurrentTurn = index === currentTurn

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
        isCurrentTurn ? ' border-blue-500 bg-blue-50' : 'bg-white'
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
  const [participants, setParticipants] = useState<Participant[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [currentTurn, setCurrentTurn] = useState(0)
  const [timeRemaining, setTimeRemaining] = useState(0)
  const [isAuctionActive, setIsAuctionActive] = useState(false)
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null)
  const [selectedRoles, setSelectedRoles] = useState<string[]>(['P', 'D', 'C', 'A'])
  const [localPlayers, setLocalPlayers] = useState<Player[]>([])

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

      // Carica partecipanti con ordine fisso dal database
      const { data: participantsData, error: participantsError } = await supabase
        .from('participants')
        .select('*')
        .eq('room_id', room.id)
        .order('created_at', { ascending: true })

      if (participantsError) {
        console.error('Errore recupero partecipanti:', participantsError)
      } else {
        setParticipants(participantsData || [])
      }

      // Carica giocatori
      const { data: playersData, error: playersError } = await supabase
        .from('players')
        .select('*')
        .eq('room_id', room.id)

      if (playersError) {
        console.error('Errore recupero giocatori:', playersError)
      } else {
        setLocalPlayers(playersData || [])
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

      // Aggiorna il turno nel database PRIMA di fare il broadcast
      const success = await updateTurnInDatabase(newTurn)

      if (success) {
        // Aggiorna lo stato locale
        setCurrentTurn(newTurn)
        setSelectedPlayer(null)

        // Broadcast del cambio turno a tutti i client
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

        // Ricarica solo i dati necessari (giocatori e budget)
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

  // Funzione per avviare l'asta
  const startAuction = useCallback(async (player: Player) => {
    setSelectedPlayer(player)
    setIsAuctionActive(true)

    try {
      await fetch('/api/auction/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId: room.id,
          playerId: player.id,
          currentTurn
        })
      })
    } catch (error) {
      console.error('Errore avvio asta:', error)
      setIsAuctionActive(false)
      setSelectedPlayer(null)
    }
  }, [room.id, currentTurn])

  // Funzioni di gestione UI
  const toggleRole = useCallback((role: string) => {
    setSelectedRoles(prev =>
      prev.includes(role)
        ? prev.filter(r => r !== role)
        : [...prev, role]
    )
  }, [])

  const toggleAllRoles = useCallback(() => {
    setSelectedRoles(prev =>
      prev.length === 4 ? [] : ['P', 'D', 'C', 'A']
    )
  }, [])

  // Gestione eventi realtime
  useEffect(() => {
    const channel = supabase
      .channel('auction_events')
      .on('broadcast', { event: 'timer_update' }, (payload) => {
        setTimeRemaining(payload.payload.timeRemaining)
      })
      .on('broadcast', { event: 'turn_changed' }, (payload) => {
        // Aggiorna solo il currentTurn, non ricaricare i partecipanti
        setCurrentTurn(payload.payload.newTurn)
      })
      .on('broadcast', { event: 'auction_closed' }, async (payload) => {
        // Gestisci chiusura asta
        setIsAuctionActive(false)
        setSelectedPlayer(null)
        setTimeRemaining(0)

        // Ricarica solo i dati necessari dal database
        await loadDataFromDatabase()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [room.id, supabase, loadDataFromDatabase])

  // Calcoli derivati
  const availablePlayers = useMemo(() =>
    localPlayers.filter(p => !p.is_assigned),
    [localPlayers]
  )

  const filteredPlayers = useMemo(() => {
    return availablePlayers.filter(p => {
      // Filtro per nome/squadra
      const matchesSearch = p.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.squadra.toLowerCase().includes(searchTerm.toLowerCase())
  
      // Filtro per ruolo
      const matchesRole = selectedRoles.includes(p.ruolo)
  
      return matchesSearch && matchesRole
    }).sort((a, b) => {
      // Ordina prima per ruolo, poi per nome
      if (a.ruolo !== b.ruolo) {
        const roleOrder = { 'P': 1, 'D': 2, 'C': 3, 'A': 4 }
        return roleOrder[a.ruolo as keyof typeof roleOrder] - roleOrder[b.ruolo as keyof typeof roleOrder]
      }
      // Se stesso ruolo, ordina per nome
      return a.nome.localeCompare(b.nome)
    })
  }, [availablePlayers, searchTerm, selectedRoles])

  return (
    <div className="lg:h-[90vh] lg:overflow-y">
      <div className="grid grid-cols-5 h-full">
        <div className="lg:col-span-3 col-span-5">
          <div className="container mx-auto lg:px-8 px-4 py-8 space-y-6">
            <div className="grid grid-cols-2 items-center space-y-2">
              <div className="lg:col-span-1 col-span-2">
                <div className="text-lg font-bold flex items-center gap-2">
                  <Users className="h-5 w-5" /> Selezione calciatore
                </div>
              </div>
              <div className="lg:col-span-1 col-span-2 flex lg:justify-end">
                <nav className="flex items-center space-x-2 text-sm text-gray-600">
                  <Link href="/" className="flex items-center hover:text-gray-900 transition-colors">
                    <Home className="h-4 w-4 mr-1" />
                    Homepage
                  </Link>
                  <ChevronRight className="h-4 w-4" />
                  <span className="text-gray-900 font-medium">Asta</span>
                  <ChevronRight className="h-4 w-4" />
                  <Link href={`/room-settings?code=${room.code}`} className="flex items-center hover:text-gray-900 transition-colors">
                    <Settings className="h-4 w-4 mr-1" />
                    Impostazioni
                  </Link>
                </nav>
              </div>
            </div>

            {/* Timer e controlli */}
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

            <div className="">
              {/* Selezione giocatore */}
              <div className="space-y-4">
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

                    {/* Filtri per ruolo */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-sm font-medium">Filtra per ruolo:</label>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={toggleAllRoles}
                          className="text-xs"
                        >
                          {selectedRoles.length === 4 ? 'Deseleziona tutti' : 'Seleziona tutti'}
                        </Button>
                      </div>
                      <div className="flex gap-2">
                        {['P', 'D', 'C', 'A'].map((role) => (
                          <Button
                            key={role}
                            variant={selectedRoles.includes(role) ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => toggleRole(role)}
                          >
                            {role}
                          </Button>
                        ))}
                      </div>
                    </div>

                    {/* Lista giocatori */}
                    <div className="max-h-96 overflow-y-auto space-y-2">
                      {filteredPlayers.map((player) => (
                        <div
                          key={player.id}
                          className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50"
                        >
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline">{player.ruolo}</Badge>
                              <span className="font-medium">{player.nome}</span>
                            </div>
                            <p className="text-sm text-gray-600">{player.squadra}</p>
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
            </div>
          </div>
        </div>
        <div className="lg:col-span-2 col-span-5 space-y-6 lg:px-8 px-4 py-8 border-l border-gray-200">
          {/* Squadre */}
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-1">
              <div className="text-lg font-bold flex items-center gap-2">
                <Users className="h-5 w-5" /> Squadre
              </div>
            </div>
            <div className="col-span-1 justify-end flex items-center">
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
            {participants.map((participant, index) => (
              <ParticipantCard
                key={participant.id}
                participant={participant}
                index={index}
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