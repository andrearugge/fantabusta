'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Search, Play } from 'lucide-react'
import { Player } from '@/types'

interface PlayerSelectorProps {
  roomId: string
  participantId: string
  currentTurn: number
  onPlayerSelected?: (player: Player) => void
}

export default function PlayerSelector({
  roomId,
  participantId,
  currentTurn,
  onPlayerSelected
}: PlayerSelectorProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedRoles, setSelectedRoles] = useState<string[]>(['P', 'D', 'C', 'A'])
  const [availablePlayers, setAvailablePlayers] = useState<Player[]>([])
  const [isStartingAuction, setIsStartingAuction] = useState(false)
  const supabase = createClient()

  // Carica i giocatori disponibili
  const loadAvailablePlayers = useCallback(async () => {
    try {
      const { data: playersData, error } = await supabase
        .from('players')
        .select('*')
        .eq('room_id', roomId)
        .eq('is_assigned', false)
        .order('nome')

      if (error) {
        console.error('Errore caricamento giocatori:', error)
        return
      }

      setAvailablePlayers(playersData || [])
    } catch (error) {
      console.error('Errore caricamento giocatori:', error)
    }
  }, [supabase, roomId])

  useEffect(() => {
    loadAvailablePlayers()
  }, [loadAvailablePlayers])

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

  // Funzione per avviare l'asta
  const startAuction = useCallback(async (player: Player) => {
    if (isStartingAuction) return
    
    setIsStartingAuction(true)
    
    try {
      const response = await fetch('/api/auction/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId,
          playerId: player.id,
          participantId,
          currentTurn
        })
      })

      if (response.ok) {
        onPlayerSelected?.(player)
        // Ricarica i giocatori disponibili
        await loadAvailablePlayers()
      } else {
        const error = await response.json()
        console.error('Errore avvio asta:', error)
      }
    } catch (error) {
      console.error('Errore avvio asta:', error)
    } finally {
      setIsStartingAuction(false)
    }
  }, [roomId, participantId, currentTurn, onPlayerSelected, loadAvailablePlayers, isStartingAuction])

  // Calcoli derivati
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
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Search className="h-5 w-5" />
          Seleziona Calciatore
        </CardTitle>
        <CardDescription>
          È il tuo turno! Scegli un calciatore per avviare l'asta.
        </CardDescription>
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
                disabled={isStartingAuction}
                size="sm"
              >
                <Play className="h-4 w-4 mr-1" />
                {isStartingAuction ? 'Avvio...' : 'Avvia Asta'}
              </Button>
            </div>
          ))}
        </div>

        {filteredPlayers.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            Nessun calciatore trovato con i filtri selezionati
          </div>
        )}
      </CardContent>
    </Card>
  )
}