'use client'

import { useState, useEffect } from 'react'
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
  const [currentAuction, setCurrentAuction] = useState<any>(null)
  const [bidAmount, setBidAmount] = useState('')
  const [timeRemaining, setTimeRemaining] = useState(0)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const [auctionResults, setAuctionResults] = useState<any>(null)
  const [bidConfirmation, setBidConfirmation] = useState<{ show: boolean; amount: number }>({ show: false, amount: 0 })

  // Aggiungi stato locale per dati che si aggiornano
  const [localParticipant, setLocalParticipant] = useState(participant)
  const [localMyPlayers, setLocalMyPlayers] = useState<Player[]>(myPlayers)
  const [localPlayerCounts, setLocalPlayerCounts] = useState(playerCounts)

  const supabase = createClient()

  // Calcola il budget massimo disponibile per un'offerta
  const calculateMaxBudget = () => {
    // Calcola il numero totale di giocatori attualmente posseduti
    const totalPlayersOwned = localMyPlayers.length

    // Calcola il numero di slot ancora liberi (25 è il totale della rosa)
    const remainingSlots = 25 - totalPlayersOwned

    // Il budget massimo è il budget attuale meno gli slot ancora liberi
    // (ogni slot libero richiede almeno 1M per essere riempito)
    return Math.max(1, localParticipant.budget - remainingSlots)
  }

  const maxBudget = calculateMaxBudget()
  const canBidForRole = (role: string) => {
    if (!role) {
      return false
    }

    const limits = { P: 3, D: 8, C: 8, A: 6 }
    const currentCount = localPlayerCounts[role as keyof typeof localPlayerCounts] // Usa i conteggi locali
    const limit = limits[role as keyof typeof limits]
    return currentCount < limit
  }

  // Funzione per aggiornare i conteggi dei ruoli
  const updatePlayerCounts = (players: Player[]) => {
    return {
      P: players.filter(p => p.ruolo === 'P').length,
      D: players.filter(p => p.ruolo === 'D').length,
      C: players.filter(p => p.ruolo === 'C').length,
      A: players.filter(p => p.ruolo === 'A').length
    }
  }

  // Realtime subscriptions
  useEffect(() => {
    const channel = supabase
      .channel('auction_events')
      .on('broadcast', { event: 'player_selected' }, (payload) => {
        setCurrentAuction(payload.payload)
        // Usa il timestamp per calcolare il tempo rimanente
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

        // Aggiorna i dati locali se questo partecipante ha vinto
        const { player, winner, winningBid } = payload.payload
        if (winner && winner.participant_id === participant.id) {
          // Aggiorna budget
          setLocalParticipant(prev => ({
            ...prev,
            budget: prev.budget - winningBid
          }))

          // Aggiungi il giocatore alla squadra SOLO se non è già presente
          setLocalMyPlayers(prev => {
            // Verifica se il giocatore è già presente
            const playerExists = prev.some(p => p.id === player.id)
            if (playerExists) {
              return prev // Non aggiungere duplicati
            }

            const newPlayer = {
              ...player,
              assigned_to: participant.id
            }
            return [...prev, newPlayer]
          })

          // Aggiorna i conteggi dei ruoli SOLO se il giocatore non era già presente
          setLocalPlayerCounts(prev => {
            const currentPlayers = localMyPlayers.filter(p => p.id !== player.id)
            const playerExists = currentPlayers.some(p => p.id === player.id)
            if (playerExists) {
              return prev // Non aggiornare i conteggi se il giocatore era già presente
            }

            return {
              ...prev,
              [player.ruolo]: prev[player.ruolo as keyof typeof prev] + 1
            }
          })
        }

        // Chiudi risultati dopo 5 secondi
        setTimeout(() => setShowResults(false), 5000)
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [participant.id])

  // Rimuovi il timer countdown locale - ora gestito dal server
  // useEffect(() => {
  //   if (timeRemaining > 0) {
  //     const timer = setTimeout(() => {
  //       setTimeRemaining(timeRemaining - 1)
  //     }, 1000)
  //     return () => clearTimeout(timer)
  //   }
  // }, [timeRemaining])

  // Aggiungi un nuovo stato per tracciare se è stata fatta almeno una bid
  const [hasMadeBid, setHasMadeBid] = useState(false)
  const [lastBidAmount, setLastBidAmount] = useState(0)

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
        // Imposta che è stata fatta una bid e aggiorna l'importo
        setHasMadeBid(true)
        setLastBidAmount(amount)
        // Rimuovi il timeout che nasconde la conferma
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

  const passAuction = async () => {
    setBidAmount('0')
    await submitBid()
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header - usa dati locali */}
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

          {/* Sezione separata per gli altri ruoli - usa conteggi locali */}
          <div className="mt-4 pt-4 border-t">
            <div className="grid grid-cols-4 gap-4 text-center">
              <div className="text-center">
                <p className="text-lg font-semibold">{localPlayerCounts.P}/3</p>
                <p className="text-sm text-gray-600">Portieri</p>
              </div>
              <div>
                <p className="text-lg font-semibold">{localPlayerCounts.D}/8</p>
                <p className="text-sm text-gray-600">Difensori</p>
              </div>
              <div>
                <p className="text-lg font-semibold">{localPlayerCounts.C}/8</p>
                <p className="text-sm text-gray-600">Centrocampisti</p>
              </div>
              <div>
                <p className="text-lg font-semibold">{localPlayerCounts.A}/6</p>
                <p className="text-sm text-gray-600">Attaccanti</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* La mia squadra - usa giocatori locali */}
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
                return (
                  <div key={role}>
                    <h4 className="font-medium mb-2">
                      {role === 'P' ? 'Portieri' :
                        role === 'D' ? 'Difensori' :
                          role === 'C' ? 'Centrocampisti' : 'Attaccanti'}
                    </h4>
                    <div className="grid gap-1">
                      {rolePlayers.map(player => (
                        <div key={player.id} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                          <span>{player.nome}</span>
                          <span className="text-sm text-gray-600">{player.squadra}</span>
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

      {/* Modal asta in corso - SOSTITUISCI QUESTO BLOCCO */}
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

              {/* Sostituisci il timer manuale con AuctionTimer */}
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