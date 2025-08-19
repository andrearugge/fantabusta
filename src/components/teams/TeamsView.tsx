'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Home, ChevronRight, Users, Trophy, Trash2, UserPlus, Download, Settings } from 'lucide-react'
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
  const [localParticipants, setLocalParticipants] = useState(participants)
  const supabase = createClient()

  const refreshParticipants = async () => {
    try {
      const { data: updatedParticipants } = await supabase
        .from('participants')
        .select('*')
        .eq('room_id', room.id)
        .order('turn_order')

      if (updatedParticipants) {
        setLocalParticipants(updatedParticipants)
      }
    } catch (error) {
      console.error('Errore ricaricamento partecipanti:', error)
    }
  }

  // Usa localParticipants invece di participants
  const teamsByParticipant = localParticipants.map(participant => {
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
      totalPlayers: playersByRole.length,
      // Calcola la massima offerta possibile
      maxBid: (() => {
        const remainingSlots = 25 - playersByRole.length
        return Math.max(1, participant.budget - remainingSlots)
      })(),
      // Calcola spesa per reparto
      spentByRole: {
        P: playersByRole.filter(p => p.ruolo === 'P').reduce((sum, p) => sum + (p.purchase_price || 0), 0),
        D: playersByRole.filter(p => p.ruolo === 'D').reduce((sum, p) => sum + (p.purchase_price || 0), 0),
        C: playersByRole.filter(p => p.ruolo === 'C').reduce((sum, p) => sum + (p.purchase_price || 0), 0),
        A: playersByRole.filter(p => p.ruolo === 'A').reduce((sum, p) => sum + (p.purchase_price || 0), 0)
      }
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
        // Aggiorna i giocatori locali
        setLocalAssignedPlayers(prev =>
          prev.filter(p => p.id !== playerId)
        )

        // AGGIUNGI: Ricarica i dati dei partecipanti dal database
        await refreshParticipants()
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

  // Funzione per esportare le rose in formato CSV
  const exportToCSV = () => {
    // Crea il contenuto CSV con separatori tra team
    let csvContent = '';

    teamsByParticipant.forEach((team, index) => {
      // Aggiungi separatore prima di ogni team (tranne il primo)
      if (index > 0) {
        csvContent += '$,$,$\n';
      }

      [...team.players.P, ...team.players.D, ...team.players.C, ...team.players.A].forEach(player => {
        csvContent += `${team.participant.display_name},${player.player_id || ''},${player.purchase_price || 0}\n`;
      });
    });

    // Crea e scarica il file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');

    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      const roomName = 'asta';
      const fileName = `export_${roomName.replace(/\s+/g, '_')}.csv`;
      link.setAttribute('download', fileName);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex space-y-1 flex-col lg:flex-row lg:justify-between lg:items-center">
        <div>
          <p className="text-xl font-bold text-black">Formazioni</p>
        </div>
        <div className="flex gap-2">
          <Button
            className="flex items-center gap-2"
            variant={'outline'}
            onClick={exportToCSV}
          >
            <Download className="h-4 w-4" />
            Esporta rose in .csv
          </Button>
          <Button
            onClick={() => setIsAssignModalOpen(true)}
            variant={'outline'}
            className="flex items-center gap-2"
          >
            <UserPlus className="h-4 w-4" />
            Assegna Calciatore
          </Button>
        </div>
      </div>

      {/* Grid delle formazioni */}
      <div className="grid gap-2 grid-cols-1 md:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-8">
        {teamsByParticipant.map((team) => (
          <Card key={team.participant.id} className="h-fit">
            <CardHeader className="pb-4 px-3">
              <CardTitle className="flex flex-col items-center gap-1">
                <div className="flex gap-1">
                  <Badge variant="outline">
                    B: {team.participant.budget}M
                  </Badge>
                  <Badge variant="default">
                    M: {team.maxBid}M
                  </Badge>
                </div>
                <div className="text-sm">{team.participant.display_name}</div>
              </CardTitle>
              <div className="flex justify-between text-sm text-gray-600">
                <Badge variant="outline">
                  {team.totalSpent} / {room.budget_default}M
                </Badge>
                <Badge variant="outline">
                  {team.totalPlayers}/25
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 px-3">
              {/* Portieri */}
              {team.players.P.length > 0 && (
                <div>
                  <h4 className="font-medium text-sm text-gray-700 mb-2 flex items-center text-xs">
                    <Badge variant="secondary" className="mr-2 text-xs">P</Badge>
                    <Badge variant="secondary" className="mr-2 text-xs">{((team.spentByRole.P / room.budget_default) * 100).toFixed(1)}%</Badge>
                    ({team.players.P.length}/3)
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
                  <h4 className="font-medium text-sm text-gray-700 mb-2 flex items-center text-xs">
                    <Badge variant="secondary" className="mr-2 text-xs">D</Badge>
                    <Badge variant="secondary" className="mr-2 text-xs">{((team.spentByRole.D / room.budget_default) * 100).toFixed(1)}%</Badge>
                    ({team.players.D.length}/8)
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
                  <h4 className="font-medium text-sm text-gray-700 mb-2 flex items-center text-xs">
                    <Badge variant="secondary" className="mr-2 text-xs">C</Badge>
                    <Badge variant="secondary" className="mr-2 text-xs">{((team.spentByRole.C / room.budget_default) * 100).toFixed(1)}%</Badge>
                    ({team.players.C.length}/8)
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
                  <h4 className="font-medium text-gray-700 mb-2 flex items-center text-xs">
                    <Badge variant="secondary" className="mr-2 text-xs">A</Badge>
                    <Badge variant="secondary" className="mr-2 text-xs">{((team.spentByRole.A / room.budget_default) * 100).toFixed(1)}%</Badge>
                    ({team.players.A.length}/6)
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