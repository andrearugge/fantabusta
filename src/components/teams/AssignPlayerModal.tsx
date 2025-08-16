'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Search, Play } from 'lucide-react'
import { Room, Participant, Player } from '@/types'
import { createClient } from '@/lib/supabase/client'

interface AssignPlayerModalProps {
  isOpen: boolean
  onClose: () => void
  room: Room
  participants: Participant[]
  onPlayerAssigned: () => void
}

export default function AssignPlayerModal({
  isOpen,
  onClose,
  room,
  participants,
  onPlayerAssigned
}: AssignPlayerModalProps) {
  const [availablePlayers, setAvailablePlayers] = useState<Player[]>([])
  const [filteredPlayers, setFilteredPlayers] = useState<Player[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedRoles, setSelectedRoles] = useState<string[]>(['P', 'D', 'C', 'A'])
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null)
  const [selectedParticipant, setSelectedParticipant] = useState<string>('')
  const [price, setPrice] = useState<string>('')
  const [isAssigning, setIsAssigning] = useState(false)
  
  const supabase = createClient()

  // Carica giocatori disponibili
  useEffect(() => {
    if (isOpen) {
      loadAvailablePlayers()
    }
  }, [isOpen, room.id])

  // Filtra giocatori
  useEffect(() => {
    const filtered = availablePlayers.filter(p => {
      const matchesSearch = p.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.squadra.toLowerCase().includes(searchTerm.toLowerCase())
      const matchesRole = selectedRoles.includes(p.ruolo)
      return matchesSearch && matchesRole
    })
    setFilteredPlayers(filtered)
  }, [availablePlayers, searchTerm, selectedRoles])

  const loadAvailablePlayers = async () => {
    const { data } = await supabase
      .from('players')
      .select('*')
      .eq('room_id', room.id)
      .eq('is_assigned', false)
      .order('nome')
    
    setAvailablePlayers(data || [])
  }

  const toggleRole = (role: string) => {
    setSelectedRoles(prev => 
      prev.includes(role) 
        ? prev.filter(r => r !== role)
        : [...prev, role]
    )
  }

  const toggleAllRoles = () => {
    setSelectedRoles(prev => 
      prev.length === 4 ? [] : ['P', 'D', 'C', 'A']
    )
  }

  const handleAssign = async () => {
    if (!selectedPlayer || !selectedParticipant || !price) {
      alert('Compila tutti i campi')
      return
    }

    const priceNum = parseFloat(price)
    if (isNaN(priceNum) || priceNum < 0) {
      alert('Inserisci un prezzo valido')
      return
    }

    setIsAssigning(true)
    
    try {
      const response = await fetch('/api/players/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerId: selectedPlayer.id,
          participantId: selectedParticipant,
          price: priceNum
        })
      })
      
      const result = await response.json()
      
      if (response.ok) {
        alert(result.message)
        onPlayerAssigned()
        handleClose()
      } else {
        alert(result.error)
      }
    } catch (error) {
      console.error('Errore assegnazione:', error)
      alert('Errore durante l\'assegnazione')
    } finally {
      setIsAssigning(false)
    }
  }

  const handleClose = () => {
    setSelectedPlayer(null)
    setSelectedParticipant('')
    setPrice('')
    setSearchTerm('')
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Assegna Calciatore</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Selezione Giocatore */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Seleziona Calciatore</h3>
            
            <Input
              placeholder="Cerca per nome o squadra..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />

            {/* Filtri per ruolo */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Filtra per ruolo:</Label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={toggleAllRoles}
                  className="text-xs"
                >
                  {selectedRoles.length === 4 ? 'Deseleziona tutti' : 'Seleziona tutti'}
                </Button>
              </div>
              <div className="flex gap-4">
                {['P', 'D', 'C', 'A'].map((role) => (
                  <label key={role} className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedRoles.includes(role)}
                      onChange={() => toggleRole(role)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm font-medium">{role}</span>
                    <Badge variant="outline" className="text-xs">
                      {availablePlayers.filter(p => p.ruolo === role).length}
                    </Badge>
                  </label>
                ))}
              </div>
            </div>

            <div className="max-h-60 overflow-y-auto space-y-2 border rounded-lg p-2">
              {filteredPlayers.map((player) => (
                <div
                  key={player.id}
                  className={`flex items-center justify-between p-3 border rounded-lg cursor-pointer transition-colors ${
                    selectedPlayer?.id === player.id 
                      ? 'bg-blue-50 border-blue-300' 
                      : 'hover:bg-gray-50'
                  }`}
                  onClick={() => setSelectedPlayer(player)}
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
                  {selectedPlayer?.id === player.id && (
                    <Badge variant="default">Selezionato</Badge>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Dettagli Assegnazione */}
          {selectedPlayer && (
            <Card>
              <CardContent className="pt-6 space-y-4">
                <h3 className="text-lg font-semibold">Dettagli Assegnazione</h3>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="participant">Partecipante</Label>
                    <Select value={selectedParticipant} onValueChange={setSelectedParticipant}>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleziona partecipante" />
                      </SelectTrigger>
                      <SelectContent>
                        {participants.map((participant) => (
                          <SelectItem key={participant.id} value={participant.id}>
                            {participant.display_name} (Budget: {participant.budget}M)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Label htmlFor="price">Prezzo (M)</Label>
                    <Input
                      id="price"
                      type="number"
                      min="0"
                      step="0.5"
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      placeholder="Es. 10"
                    />
                  </div>
                </div>

                <div className="bg-gray-50 p-3 rounded-lg">
                  <p className="text-sm">
                    <strong>Giocatore:</strong> {selectedPlayer.nome} ({selectedPlayer.ruolo}) - {selectedPlayer.squadra}
                  </p>
                  {selectedParticipant && (
                    <p className="text-sm">
                      <strong>Assegna a:</strong> {participants.find(p => p.id === selectedParticipant)?.display_name}
                    </p>
                  )}
                  {price && (
                    <p className="text-sm">
                      <strong>Prezzo:</strong> {price}M
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Pulsanti */}
        <div className="flex justify-end gap-2 pt-4">
          <Button variant="outline" onClick={handleClose}>
            Annulla
          </Button>
          <Button 
            onClick={handleAssign}
            disabled={!selectedPlayer || !selectedParticipant || !price || isAssigning}
          >
            {isAssigning ? 'Assegnando...' : 'Assegna Calciatore'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}