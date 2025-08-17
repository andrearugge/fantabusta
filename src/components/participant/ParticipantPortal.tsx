'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Progress } from '@/components/ui/progress'
import { User, DollarSign, Users, Clock, CheckCircle } from 'lucide-react'
import { Participant, Player } from '@/types'
import { AuctionTimer } from '../auction/AuctionTimer'

interface ParticipantPortalProps {
  participant: Participant & { rooms: any }
  myPlayers: Player[]
  playerCounts: { P: number; D: number; C: number; A: number }
}

export default function ParticipantPortal({
  participant,
  myPlayers,
  playerCounts
}: ParticipantPortalProps) {
  // Stati per l'asta corrente
  const [currentAuction, setCurrentAuction] = useState<any>(null)
  const [bidAmount, setBidAmount] = useState('')
  const [timeRemaining, setTimeRemaining] = useState(0)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Stati per i risultati dell'asta
  const [showResults, setShowResults] = useState(false)
  const [auctionResults, setAuctionResults] = useState<any>(null)

  // Stati per la conferma dell'offerta
  const [hasMadeBid, setHasMadeBid] = useState(false)
  const [lastBidAmount, setLastBidAmount] = useState(0)

  // Stati locali per dati che si aggiornano in tempo reale
  const [localParticipant, setLocalParticipant] = useState(participant)
  const [localMyPlayers, setLocalMyPlayers] = useState<Player[]>(myPlayers)
  const [localPlayerCounts, setLocalPlayerCounts] = useState(playerCounts)

  const supabase = createClient()

  // Funzione per aggiornare i conteggi dei ruoli
  const updatePlayerCounts = useCallback((players: Player[]) => {
    return {
      P: players.filter(p => p.ruolo === 'P').length,
      D: players.filter(p => p.ruolo === 'D').length,
      C: players.filter(p => p.ruolo === 'C').length,
      A: players.filter(p => p.ruolo === 'A').length
    }
  }, [])

  // Funzione per ricaricare i dati dal database
  const refreshPlayerData = useCallback(async () => {
    try {
      // Ricarica i giocatori assegnati al partecipante
      const { data: playersData, error: playersError } = await supabase
        .from('players')
        .select('*, purchase_price')
        .eq('assigned_to', participant.id)

      if (playersError) {
        console.error('Errore nel caricamento giocatori:', playersError)
        return
      }

      // Ricarica il budget del partecipante
      const { data: participantData, error: participantError } = await supabase
        .from('participants')
        .select('budget')
        .eq('id', participant.id)
        .single()

      if (participantError) {
        console.error('Errore nel caricamento partecipante:', participantError)
        return
      }

      // Aggiorna gli stati locali
      const updatedPlayers = playersData || []
      setLocalMyPlayers(updatedPlayers)
      setLocalPlayerCounts(updatePlayerCounts(updatedPlayers))
      setLocalParticipant(prev => ({
        ...prev,
        budget: participantData.budget
      }))
    } catch (error) {
      console.error('Errore nel refresh dei dati:', error)
    }
  }, [participant.id, supabase, updatePlayerCounts])

  // Calcola il budget massimo disponibile per un'offerta
  const calculateMaxBudget = useCallback(() => {
    const totalPlayersOwned = localMyPlayers.length
    const remainingSlots = 25 - totalPlayersOwned
    return Math.max(1, localParticipant.budget - remainingSlots)
  }, [localMyPlayers.length, localParticipant.budget])

  // Verifica se può fare offerte per un ruolo specifico
  const canBidForRole = useCallback((role: string) => {
    if (!role) return false

    const limits = { P: 3, D: 8, C: 8, A: 6 }
    const currentCount = localPlayerCounts[role as keyof typeof localPlayerCounts]
    const limit = limits[role as keyof typeof limits]
    return currentCount < limit
  }, [localPlayerCounts])

  const maxBudget = calculateMaxBudget()

  // Funzione per inviare un'offerta
  const submitBid = async () => {
    if (!currentAuction || !bidAmount || isSubmitting) return

    const amount = parseInt(bidAmount)
    if (amount <= 0 || amount > maxBudget) return

    setIsSubmitting(true)

    try {
      const response = await fetch('/api/bids/place', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId: participant.room_id,
          playerId: currentAuction.player.id,
          participantId: participant.id,
          amount
        })
      })

      if (response.ok) {
        setHasMadeBid(true)
        setLastBidAmount(amount)
      } else {
        const error = await response.json()
        console.error('Errore API:', error)
      }
    } catch (error) {
      console.error('Errore invio offerta:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  // Realtime subscriptions
  useEffect(() => {
    const channel = supabase
      .channel('auction_events')
      .on('broadcast', { event: 'player_selected' }, (payload) => {
        setCurrentAuction(payload.payload)
        const { auctionEndTime } = payload.payload
        const timeLeft = Math.max(0, Math.ceil((auctionEndTime - Date.now()) / 1000))
        setTimeRemaining(timeLeft)
        setBidAmount('')
        setShowResults(false)
        setHasMadeBid(false)
        setLastBidAmount(0)
      })
      .on('broadcast', { event: 'timer_update' }, (payload) => {
        setTimeRemaining(payload.payload.timeRemaining)
      })
      .on('broadcast', { event: 'auction_closed' }, (payload) => {
        setCurrentAuction(null)
        setTimeRemaining(0)
        setAuctionResults(payload.payload)
        setShowResults(true)

        // Aggiorna sempre i dati dal database per tutti i partecipanti
        refreshPlayerData()

        // Chiudi risultati dopo 5 secondi
        setTimeout(() => setShowResults(false), 5000)
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [participant.id, refreshPlayerData, supabase])

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header con informazioni partecipante */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            {localParticipant.display_name}
          </CardTitle>
          <CardDescription>
            Asta: {localParticipant.rooms.code}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="text-center">
              <DollarSign className="h-6 w-6 mx-auto mb-1" />
              <p className="text-2xl font-bold">{localParticipant.budget}M</p>
              <p className="text-sm text-gray-600">Budget</p>
            </div>
            <div className="text-center">
              <Users className="h-6 w-6 mx-auto mb-1" />
              <p className="text-2xl font-bold">{localMyPlayers.length}/25</p>
              <p className="text-sm text-gray-600">Giocatori</p>
            </div>
          </div>

          {/* Conteggi per ruolo */}
          <div className="mt-4 pt-4 border-t">
            <div className="grid grid-cols-4 gap-4 text-center">
              <div className="text-center">
                <p className="text-lg font-semibold">P: {localPlayerCounts.P}/3</p>
              </div>
              <div>
                <p className="text-lg font-semibold">D: {localPlayerCounts.D}/8</p>
              </div>
              <div>
                <p className="text-lg font-semibold">C: {localPlayerCounts.C}/8</p>
              </div>
              <div>
                <p className="text-lg font-semibold">A: {localPlayerCounts.A}/6</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* La mia squadra */}
      <Card>
        <CardHeader>
          <CardTitle>La Mia Squadra</CardTitle>
        </CardHeader>
        <CardContent>
          {localMyPlayers.length === 0 ? (
            <p className="text-gray-600 text-center py-8">
              Nessun giocatore ancora acquistato
            </p>
          ) : (
            <div className="grid gap-2">
              {['P', 'D', 'C', 'A'].map(role => {
                const rolePlayers = localMyPlayers.filter(p => p.ruolo === role)
                if (rolePlayers.length === 0) return null

                return (
                  <div key={role}>
                    <h4 className="font-medium mb-2">
                      {role === 'P' ? 'Portieri' :
                        role === 'D' ? 'Difensori' :
                          role === 'C' ? 'Centrocampisti' : 'Attaccanti'}
                    </h4>
                    <div className="grid gap-1">
                      {rolePlayers.map(player => (
                        <div key={player.id} className="grid grid-cols-3 p-2 bg-gray-50 rounded">
                          <div className="col-span-1 font-medium">{player.nome}</div>
                          <div className="col-span-1">{player.squadra}</div>
                          <div className="col-span-1 font-semibold text-green-600 text-right">
                            {player.purchase_price ? `${player.purchase_price}M` : 'N/A'}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal asta in corso */}
      <Dialog open={!!currentAuction && timeRemaining > 0}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Asta in corso
            </DialogTitle>
          </DialogHeader>

          {currentAuction && currentAuction.player && currentAuction.player.ruolo && (
            <div className="space-y-4">
              <div className="text-center">
                <h3 className="text-xl font-bold">{currentAuction.player.nome}</h3>
                <div className="flex justify-center gap-2 mt-2">
                  <Badge>{currentAuction.player.ruolo}</Badge>
                  <Badge variant="outline">{currentAuction.player.squadra}</Badge>
                </div>
              </div>

              <AuctionTimer
                initialTime={parseInt(process.env.NEXT_PUBLIC_TIMER || '30')}
                isActive={true}
                onTimeUp={() => setCurrentAuction(null)}
                roomId={participant.room_id}
                playerId={currentAuction.player.id}
              />

              {hasMadeBid && (
                <div className="bg-green-50 border border-green-200 rounded-sm p-1 text-center">
                  <div className="flex items-center justify-center gap-2 text-green-700">
                    <span className="font-medium">Offerta inviata: {lastBidAmount}M</span>
                  </div>
                </div>
              )}

              {canBidForRole(currentAuction.player.ruolo) ? (
                <div className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-sm font-medium">La tua offerta (max {maxBudget}M)</label>
                    <Input
                      type="number"
                      value={bidAmount}
                      onChange={(e) => setBidAmount(e.target.value)}
                      placeholder="Inserisci importo..."
                      min="1"
                      max={maxBudget}
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Puoi modificare la tua offerta fino alla scadenza del tempo
                    </p>
                  </div>

                  <Button
                    onClick={submitBid}
                    disabled={!bidAmount || parseInt(bidAmount) <= 0 || parseInt(bidAmount) > maxBudget || isSubmitting}
                    className="w-full"
                  >
                    {isSubmitting ? 'Invio...' : 'Offri'}
                  </Button>
                </div>
              ) : (
                <div className="text-center py-4">
                  <p className="text-red-600 font-medium">
                    Non puoi fare offerte per questo ruolo
                  </p>
                  <p className="text-sm text-gray-600">
                    Hai già il numero massimo di giocatori per questo ruolo
                  </p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal risultati */}
      <Dialog open={showResults}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Risultato Asta</DialogTitle>
          </DialogHeader>

          {auctionResults && (
            <div className="space-y-4 text-center">
              <div>
                <h3 className="text-xl font-bold">{auctionResults.player?.nome}</h3>
                <Badge className="mt-1">{auctionResults.player?.ruolo}</Badge>
              </div>

              <div>
                <p className="text-lg">Vincitore:</p>
                <p className="text-xl font-bold text-green-600">
                  {auctionResults.winner?.display_name}
                </p>
                <p className="text-lg font-semibold">
                  {auctionResults.winningBid}M
                </p>
              </div>

              {auctionResults.allBids && (
                <div className="text-left">
                  <p className="font-medium mb-2">Tutte le offerte:</p>
                  <div className="space-y-1 text-sm">
                    {auctionResults.allBids.map((bid: any, index: number) => (
                      <div key={index} className="flex justify-between items-center">
                        <div className="flex-1">
                          <span>{bid.participant_name}</span>
                          {bid.timing_seconds && (
                            <span className="text-xs text-gray-500 ml-2">
                              ({bid.timing_seconds}s)
                            </span>
                          )}
                        </div>
                        <span className="font-medium">{bid.amount}M</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <Button
                onClick={() => setShowResults(false)}
                className="w-full mt-4"
                variant="outline"
              >
                Chiudi
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}