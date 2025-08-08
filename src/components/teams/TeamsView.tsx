'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Home, ChevronRight, Users, Trophy } from 'lucide-react'
import { Room, Participant, Player } from '@/types'
import Link from 'next/link'

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
  
  // Raggruppa giocatori per partecipante
  const teamsByParticipant = participants.map(participant => {
    const playersByRole = assignedPlayers.filter(p => p.assigned_to === participant.id)
    
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
                <span>Rimanente: <span className="font-semibold">{500 - team.totalSpent}M</span></span>
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
                        <span className="text-green-600 font-medium ml-2">{player.purchase_price || 0}M</span>
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
                        <span className="text-green-600 font-medium ml-2">{player.purchase_price || 0}M</span>
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
                        <span className="text-green-600 font-medium ml-2">{player.purchase_price || 0}M</span>
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
                        <span className="text-green-600 font-medium ml-2">{player.purchase_price || 0}M</span>
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
    </div>
  )
}