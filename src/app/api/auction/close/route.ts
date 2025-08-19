import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@/lib/logger'
import type { Participant, Player, Bid } from '@/types'

// Types per il refactor
interface AuctionData {
  roomData: { current_turn: number }
  participants: Participant[]
  bids: (Bid & { participants: { display_name: string } })[]
  player: Player
  activeTimerId: string
}

interface AuctionResult {
  winner: any
  winningBid: number
  noOffers: boolean
  currentTurnParticipant: Participant | null
}

interface BidData {
  participant_name: string
  amount: number
  timing_seconds: string | null
}

// Validation
function validateRequest(roomId: string, playerId: string) {
  if (!roomId || !playerId) {
    throw new Error('Parametri mancanti')
  }
}

// Data fetching
async function fetchAuctionData(supabase: any, roomId: string, playerId: string): Promise<AuctionData> {
  try {
    // Fetch room data
    const { data: roomData, error: roomError } = await supabase
      .from('rooms')
      .select('current_turn')
      .eq('id', roomId)
      .single()
    
    if (roomError) {
      logger.error('Errore recupero room:', roomError)
      throw new Error('Errore recupero room')
    }

    // Fetch participants
    const { data: participants, error: participantsError } = await supabase
      .from('participants')
      .select('id, display_name, budget, turn_order')
      .eq('room_id', roomId)
      .order('turn_order', { ascending: true })
    
    if (participantsError) {
      logger.error('Errore recupero partecipanti:', participantsError)
      throw new Error('Errore recupero partecipanti')
    }

    // Fetch active auction timer for this player
    const { data: activeTimer, error: timerError } = await supabase
      .from('auction_timers')
      .select('id')
      .eq('player_id', playerId)
      .eq('room_id', roomId)
      .eq('is_active', true)
      .single()
    
    if (timerError) {
      logger.error('Errore recupero timer attivo:', timerError)
      throw new Error('Nessun timer attivo trovato')
    }

    // Fetch bids for this auction timer
    const { data: bids, error: bidsError } = await supabase
      .from('bids')
      .select(`
        *,
        participants!participant_id (
          display_name
        )
      `)
      .eq('auction_timer_id', activeTimer.id)
      .order('amount', { ascending: false })
      .order('created_at', { ascending: true })
    
    if (bidsError) {
      logger.error('Errore recupero offerte:', bidsError)
      throw new Error('Errore recupero offerte')
    }

    // Fetch player data
    const { data: player, error: playerError } = await supabase
      .from('players')
      .select('*')
      .eq('id', playerId)
      .single()

    if (playerError) {
      logger.error('Errore recupero giocatore:', playerError)
      throw new Error('Errore recupero giocatore')
    }

    return {
      roomData,
      participants: participants || [],
      bids: bids || [],
      player,
      activeTimerId: activeTimer.id
    }
  } catch (error) {
    logger.error('Errore fetch auction data:', error)
    throw error
  }
}

// Current turn participant calculation
function getCurrentTurnParticipant(roomData: { current_turn: number }, participants: Participant[]): Participant | null {
  if (!participants.length) return null
  
  const participantTurnOrder = roomData.current_turn % participants.length
  const currentTurnParticipant = participants.find(p => p.turn_order === participantTurnOrder) || null
  
  logger.debug('Current turn calculation:', {
    currentTurn: roomData.current_turn,
    participantsLength: participants.length,
    participantTurnOrder,
    foundParticipant: currentTurnParticipant?.display_name
  })
  
  return currentTurnParticipant
}

// Auction timing calculation
function calculateAuctionStartTime(bids: any[]): Date | null {
  if (!bids || bids.length === 0) return null
  
  const sortedByTime = [...bids].sort((a, b) => 
    new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  )
  
  // Sottrai 30 secondi dal primo bid per stimare l'inizio dell'asta
  return new Date(new Date(sortedByTime[0].created_at).getTime() - 30000)
}

// Bid processing
function processBids(bids: any[], auctionStartTime: Date | null): { validBids: any[], allBidsData: BidData[] } {
  const validBids = bids.filter(bid => bid.amount > 0)
  
  const allBidsData = bids.map(bid => {
    let timingSeconds = null
    if (auctionStartTime) {
      const bidTime = new Date(bid.created_at)
      const diffMs = bidTime.getTime() - auctionStartTime.getTime()
      timingSeconds = Math.max(0, (diffMs / 1000)).toFixed(2)
    }
    
    return {
      participant_name: bid.participants?.display_name,
      amount: bid.amount,
      timing_seconds: timingSeconds
    }
  })
  
  return { validBids, allBidsData }
}

// Player assignment
async function assignPlayerToWinner(
  supabase: any, 
  playerId: string, 
  participantId: string, 
  price: number, 
  roomId: string,
  auctionTimerId: string
): Promise<{ participant: any, player: any }> {
  try {
    logger.info('Starting player assignment', {
      playerId,
      participantId,
      price,
      roomId,
      auctionTimerId
    })

    // Assign player with detailed logging
    const { data: updateData, error: playerError } = await supabase
      .from('players')
      .update({ 
        is_assigned: true,
        assigned_to: participantId,
        purchase_price: price
      })
      .eq('id', playerId)
      .select() // Add select to get updated data
    
    if (playerError) {
      logger.error('Errore assegnazione giocatore:', playerError)
      throw new Error(`Errore assegnazione giocatore: ${playerError.message}`)
    }

    logger.info('Player update successful', {
      playerId,
      updatedData: updateData,
      purchase_price: price
    })

    // Verify the update was successful
    const { data: verifyPlayer, error: verifyError } = await supabase
      .from('players')
      .select('id, purchase_price, is_assigned, assigned_to')
      .eq('id', playerId)
      .single()
    
    if (verifyError) {
      logger.error('Errore verifica aggiornamento giocatore:', verifyError)
    } else {
      logger.info('Player verification after update', {
        playerId,
        verifiedData: verifyPlayer
      })
    }

    // Update participant budget
    const { data: participant, error: participantFetchError } = await supabase
      .from('participants')
      .select('budget, display_name')
      .eq('id', participantId)
      .single()
    
    if (participantFetchError) {
      logger.error('Errore recupero budget partecipante:', participantFetchError)
      throw new Error('Errore recupero budget partecipante')
    }

    const newBudget = participant.budget - price
    
    const { error: budgetError } = await supabase
      .from('participants')
      .update({ budget: newBudget })
      .eq('id', participantId)
    
    if (budgetError) {
      logger.error('Errore aggiornamento budget:', budgetError)
      throw new Error('Errore aggiornamento budget')
    }

    // Recupera i dati del giocatore per il broadcast
    const { data: player, error: playerFetchError } = await supabase
      .from('players')
      .select('*')
      .eq('id', playerId)
      .single()
    
    if (playerFetchError) {
      logger.error('Errore recupero dati giocatore:', playerFetchError)
      throw new Error('Errore recupero dati giocatore')
    }

    logger.info('Final player data after assignment', {
      playerId,
      finalPlayerData: player
    })

    // Crea record bid per tracciare l'acquisto con auction_timer_id
    const { error: bidError } = await supabase
      .from('bids')
      .insert({
        room_id: roomId,
        player_id: playerId,
        participant_id: participantId,
        amount: price,
        auction_timer_id: auctionTimerId
      })
    
    if (bidError) {
      logger.error('Errore creazione bid per tracciamento:', bidError)
      // Non blocchiamo l'operazione per questo errore
    }

    logger.info('Player assigned successfully', {
      playerId,
      participantId,
      price,
      newBudget,
      finalPurchasePrice: player.purchase_price
    })

    return { participant, player }
  } catch (error) {
    logger.error('Errore assign player:', error)
    throw error
  }
}

// Auction result determination
async function determineAuctionResult(
  supabase: any,
  validBids: any[],
  currentTurnParticipant: Participant | null,
  playerId: string,
  roomId: string,
  auctionTimerId: string
): Promise<AuctionResult> {
  let winner = null
  let winningBid = 0
  let noOffers = false

  if (validBids.length > 0) {
    // Case: valid bids exist
    winner = validBids[0]
    winningBid = winner.amount

    // Assegna il giocatore al vincitore
    await assignPlayerToWinner(supabase, playerId, winner.participant_id, winningBid, roomId, auctionTimerId)

    return {
      winner,
      winningBid,
      noOffers: false,
      currentTurnParticipant
    }
  } else {
    // Case: no valid bids - assign to current turn participant for 1M
    noOffers = true
    
    if (currentTurnParticipant) {
      await assignPlayerToWinner(supabase, playerId, currentTurnParticipant.id, 1, roomId, auctionTimerId)
      
      // Set winner for payload
      winner = {
        participant_id: currentTurnParticipant.id,
        participants: { display_name: currentTurnParticipant.display_name }
      }
      winningBid = 1
    }
  }

  return {
    winner,
    winningBid,
    noOffers,
    currentTurnParticipant
  }
}

// Realtime event broadcasting
async function broadcastAuctionClosed(
  supabase: any,
  player: Player,
  result: AuctionResult,
  allBidsData: BidData[],
  roomId: string
): Promise<void> {
  try {
    // Broadcast auction_closed event
    await supabase
      .channel('auction_events')
      .send({
        type: 'broadcast',
        event: 'auction_closed',
        payload: {
          player,
          winner: result.winner ? {
            display_name: result.winner.participants?.display_name,
            participant_id: result.winner.participant_id
          } : null,
          winningBid: result.winningBid,
          allBids: allBidsData,
          noOffers: result.noOffers,
          message: result.noOffers ? 'Nessuna offerta ricevuta' : undefined,
          currentTurnParticipant: result.currentTurnParticipant ? {
            display_name: result.currentTurnParticipant.display_name,
            participant_id: result.currentTurnParticipant.id
          } : null
        }
      })

    // Broadcast player_assigned event per aggiornamenti team
    if (result.winner) {
      await supabase
        .channel('team_updates')
        .send({
          type: 'broadcast',
          event: 'player_assigned',
          payload: {
            playerId: player.id,
            participantId: result.winner.participant_id,
            price: result.winningBid,
            playerName: player.nome,
            participantName: result.winner.participants?.display_name
          }
        })
    }
    
    logger.info('Auction events broadcasted successfully')
  } catch (error) {
    logger.error('Errore broadcast auction events:', error)
    throw error
  }
}

// Skip turn after auction
async function skipTurnAfterAuction(supabase: any, roomId: string): Promise<void> {
  try {
    // Recupera i dati della room e i partecipanti
    const { data: room, error: roomError } = await supabase
      .from('rooms')
      .select('current_turn')
      .eq('id', roomId)
      .single()

    if (roomError) {
      logger.error('Errore recupero room per skip turn:', roomError)
      throw new Error('Errore nel recupero della room')
    }

    const { data: participants, error: participantsError } = await supabase
      .from('participants')
      .select('*')
      .eq('room_id', roomId)
      .order('turn_order')

    if (participantsError) {
      logger.error('Errore recupero partecipanti per skip turn:', participantsError)
      throw new Error('Errore nel recupero dei partecipanti')
    }

    // Calcola il prossimo turno
    const currentTurn = room.current_turn ?? 0
    const nextTurn = (currentTurn + 1) % participants.length

    // Aggiorna il turno nel database
    const { error: updateError } = await supabase
      .from('rooms')
      .update({ current_turn: nextTurn })
      .eq('id', roomId)

    if (updateError) {
      logger.error('Errore aggiornamento turno dopo asta:', updateError)
      throw new Error('Errore nell\'aggiornamento del turno')
    }

    // CORREZIONE CRITICA: Usa il client Supabase corretto per il broadcast
    const { createClient } = await import('@/lib/supabase/client')
    const clientSupabase = createClient()
    
    // Invia broadcast del cambio turno usando il canale corretto
    const channel = clientSupabase.channel(`room-${roomId}`)
    await channel.send({
      type: 'broadcast',
      event: 'turn_changed',
      payload: {
        roomId: roomId,
        newTurn: nextTurn,
        previousTurn: currentTurn
      }
    })

    logger.info(`Turno avanzato automaticamente dopo asta nella room ${roomId}: ${currentTurn} -> ${nextTurn}`)
  } catch (error) {
    logger.error('Errore nel passaggio automatico del turno:', error)
    // Non lanciare l'errore per non bloccare la chiusura dell'asta
  }
}

// Cleanup operations
async function cleanupAuction(supabase: any, playerId: string, roomId: string): Promise<void> {
  try {
    // Deactivate timers (le bid vengono mantenute per lo storico)
    const { error: timersError } = await supabase
      .from('auction_timers')
      .update({ is_active: false })
      .eq('player_id', playerId)
      .eq('room_id', roomId)
      .eq('is_active', true)
    
    if (timersError) {
      logger.error('Errore disattivazione timer:', timersError)
      throw new Error('Errore disattivazione timer')
    }

    logger.info('Auction cleanup completed successfully')
  } catch (error) {
    logger.error('Errore cleanup auction:', error)
    throw error
  }
}

// Main API handler
export async function POST(request: NextRequest) {
  try {
    const { roomId, playerId } = await request.json()
    
    // Validation
    validateRequest(roomId, playerId)
    
    const supabase = await createClient()
    
    // Fetch all required data
    const auctionData = await fetchAuctionData(supabase, roomId, playerId)
    
    // Calculate current turn participant
    const currentTurnParticipant = getCurrentTurnParticipant(auctionData.roomData, auctionData.participants)
    
    // Calculate auction timing
    const auctionStartTime = calculateAuctionStartTime(auctionData.bids)
    
    // Process bids
    const { validBids, allBidsData } = processBids(auctionData.bids, auctionStartTime)
    
    // Determine auction result (include assignment)
    const result = await determineAuctionResult(
      supabase, 
      validBids, 
      currentTurnParticipant, 
      playerId, 
      roomId, 
      auctionData.activeTimerId
    )
    
    // Broadcast realtime events
    await broadcastAuctionClosed(supabase, auctionData.player, result, allBidsData, roomId)
    
    // Cleanup
    await cleanupAuction(supabase, playerId, roomId)
    
    // Skip turn after auction
    await skipTurnAfterAuction(supabase, roomId)
    
    logger.info('Auction closed successfully', {
      playerId,
      winner: result.winner?.participant_id,
      winningBid: result.winningBid,
      totalBids: auctionData.bids.length,
      noOffers: result.noOffers
    })

    return NextResponse.json({
      success: true,
      winner: result.winner,
      winningBid: result.winningBid,
      totalBids: auctionData.bids.length,
      noOffers: result.noOffers
    })
    
  } catch (error) {
    logger.error('Errore API close auction:', error)
    
    const errorMessage = error instanceof Error ? error.message : 'Errore interno del server'
    const statusCode = errorMessage.includes('Parametri mancanti') ? 400 : 500
    
    return NextResponse.json(
      { error: errorMessage },
      { status: statusCode }
    )
  }
}