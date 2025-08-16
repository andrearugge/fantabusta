'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Home, ChevronRight, Users, Trophy, Trash2, UserPlus } from 'lucide-react'
import { Room, Participant, Player } from '@/types'
import Link from 'next/link'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import AssignPlayerModal from './AssignPlayerModal'

interface TeamsViewProps {
  room: Room
  participants: Participant[]
  assignedPlayers: (Player & {
    participants?: {
      id: string
      display_name: string
    }
    purchase_price?: number
  })[]
}

export default function TeamsView({
  room,
  participants,
  assignedPlayers
}: TeamsViewProps) {
  const [isRemoving, setIsRemoving] = useState<string | null>(null)
  const [localAssignedPlayers, setLocalAssignedPlayers] = useState(assignedPlayers)
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false)
  const supabase = createClient()

  const teamsByParticipant = participants.map(participant => {
    const playersByRole = localAssignedPlayers.filter(p => p.assigned_to === participant.id)
    
    const teamData = {
      participant,
      players: {
        P: playersByRole.filter(p => p.ruolo === 'P'),
        D: playersByRole.filter(p => p.ruolo === 'D'),
        C: playersByRole.filter(p => p.ruolo === 'C'),
        A: playersByRole.filter(p => p.ruolo === 'A')
      },
      totalSpent: playersByRole.reduce((sum, p) => sum + (p.purchase_price || 0), 0),
      totalPlayers: playersByRole.length
    }
    
    return teamData
  })

  const handleRemovePlayer = async (playerId: string, participantId: string) => {
    if (isRemoving) return
    
    setIsRemoving(playerId)
    
    try {
      const response = await fetch('/api/players/remove', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId, participantId })
      })
      
      const result = await response.json()
      
      if (response.ok) {
        setLocalAssignedPlayers(prev => 
          prev.filter(p => p.id !== playerId)
        )
      } else {
        console.error('Errore rimozione:', result.error)
        alert('Errore durante la rimozione del giocatore')
      }
    } catch (error) {
      console.error('Errore rimozione giocatore:', error)
      alert('Errore durante la rimozione del giocatore')
    } finally {
      setIsRemoving(null)
    }
  }

  const handlePlayerAssigned = () => {
    window.location.reload()
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
        <Link href={`/auction/${room.code}`} className="flex items-center hover:text-gray-900 transition-colors">
          <Trophy className="h-4 w-4 mr-1" />
          Asta {room.code}
        </Link>
        <ChevronRight className="h-4 w-4" />
        <span className="text-gray-900 font-medium flex items-center">
          <Users className="h-4 w-4 mr-1" />
          Formazioni
        </span>
      </nav>

      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-black">Formazioni - Asta {room.code}</h1>
          <p className="text-gray-600">Visualizza tutte le squadre dei partecipanti</p>
        </div>
        <Button
          onClick={() => setIsAssignModalOpen(true)}
          className="flex items-center gap-2"
        >
          <UserPlus className="h-4 w-4" />
          Assegna Calciatore
        </Button>
      </div>

      {/* Grid delle formazioni */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {teamsByParticipant.map((team) => (
          <Card key={team.participant.id} className="h-fit">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center justify-between">
                <span className="text-lg">{team.participant.display_name}</span>
                <Badge variant="outline">
                  {team.totalPlayers}/25
                </Badge>
              </CardTitle>
              <div className="flex justify-between text-sm text-gray-600">
                <span>Budget speso: <span className="font-semibold text-green-600">{team.totalSpent}M</span></span>
                <span>Rimanente: <span className="font-semibold">{team.participant.budget}M</span></span>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Portieri */}
              {team.players.P.length > 0 && (
                <div>
                  <h4 className="font-medium text-sm text-gray-700 mb-2 flex items-center">
                    <Badge variant="secondary" className="mr-2 text-xs">P</Badge>
                    Portieri ({team.players.P.length}/3)
                  </h4>
                  <div className="space-y-1">
                    {team.players.P.map((player) => (
                      <div key={player.id} className="flex justify-between items-center text-sm">
                        <span className="truncate">{player.nome}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-green-600 font-medium">{player.purchase_price || 0}M</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                            onClick={() => handleRemovePlayer(player.id, team.participant.id)}
                            disabled={isRemoving === player.id}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Difensori */}
              {team.players.D.length > 0 && (
                <div>
                  <h4 className="font-medium text-sm text-gray-700 mb-2 flex items-center">
                    <Badge variant="secondary" className="mr-2 text-xs">D</Badge>
                    Difensori ({team.players.D.length}/8)
                  </h4>
                  <div className="space-y-1">
                    {team.players.D.map((player) => (
                      <div key={player.id} className="flex justify-between items-center text-sm">
                        <span className="truncate">{player.nome}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-green-600 font-medium">{player.purchase_price || 0}M</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                            onClick={() => handleRemovePlayer(player.id, team.participant.id)}
                            disabled={isRemoving === player.id}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Centrocampisti */}
              {team.players.C.length > 0 && (
                <div>
                  <h4 className="font-medium text-sm text-gray-700 mb-2 flex items-center">
                    <Badge variant="secondary" className="mr-2 text-xs">C</Badge>
                    Centrocampisti ({team.players.C.length}/8)
                  </h4>
                  <div className="space-y-1">
                    {team.players.C.map((player) => (
                      <div key={player.id} className="flex justify-between items-center text-sm">
                        <span className="truncate">{player.nome}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-green-600 font-medium">{player.purchase_price || 0}M</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                            onClick={() => handleRemovePlayer(player.id, team.participant.id)}
                            disabled={isRemoving === player.id}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Attaccanti */}
              {team.players.A.length > 0 && (
                <div>
                  <h4 className="font-medium text-sm text-gray-700 mb-2 flex items-center">
                    <Badge variant="secondary" className="mr-2 text-xs">A</Badge>
                    Attaccanti ({team.players.A.length}/6)
                  </h4>
                  <div className="space-y-1">
                    {team.players.A.map((player) => (
                      <div key={player.id} className="flex justify-between items-center text-sm">
                        <span className="truncate">{player.nome}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-green-600 font-medium">{player.purchase_price || 0}M</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                            onClick={() => handleRemovePlayer(player.id, team.participant.id)}
                            disabled={isRemoving === player.id}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Messaggio se nessun giocatore */}
              {team.totalPlayers === 0 && (
                <div className="text-center text-gray-500 py-4">
                  <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Nessun giocatore acquistato</p>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Modale Assegnazione */}
      <AssignPlayerModal
        isOpen={isAssignModalOpen}
        onClose={() => setIsAssignModalOpen(false)}
        room={room}
        participants={participants}
        onPlayerAssigned={handlePlayerAssigned}
      />
    </div>
  )
}