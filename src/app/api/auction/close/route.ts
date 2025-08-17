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

    // Fetch bids
    const { data: bids, error: bidsError } = await supabase
      .from('bids')
      .select(`
        *,
        participants!participant_id (
          display_name
        )
      `)
      .eq('player_id', playerId)
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
      player
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
async function assignPlayerToWinner(supabase: any, playerId: string, participantId: string, price: number): Promise<void> {
  try {
    // Assign player
    const { error: playerError } = await supabase
      .from('players')
      .update({ 
        is_assigned: true,
        assigned_to: participantId,
        purchase_price: price
      })
      .eq('id', playerId)
    
    if (playerError) {
      logger.error('Errore assegnazione giocatore:', playerError)
      throw new Error('Errore assegnazione giocatore')
    }

    // Update participant budget
    const { data: participant, error: participantFetchError } = await supabase
      .from('participants')
      .select('budget')
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

    logger.info('Player assigned successfully', {
      playerId,
      participantId,
      price,
      newBudget
    })
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
  playerId: string
): Promise<AuctionResult> {
  let winner = null
  let winningBid = 0
  let noOffers = false

  if (validBids.length > 0) {
    // Case: valid bids exist
    winner = validBids[0]
    winningBid = winner.amount
    
    await assignPlayerToWinner(supabase, playerId, winner.participant_id, winningBid)
  } else {
    // Case: no valid bids - assign to current turn participant for 1M
    noOffers = true
    
    if (currentTurnParticipant) {
      await assignPlayerToWinner(supabase, playerId, currentTurnParticipant.id, 1)
      
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
  allBidsData: BidData[]
): Promise<void> {
  try {
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
    
    logger.info('Auction closed event broadcasted successfully')
  } catch (error) {
    logger.error('Errore broadcast auction closed:', error)
    throw error
  }
}

// Cleanup operations
async function cleanupAuction(supabase: any, playerId: string, roomId: string): Promise<void> {
  try {
    // Delete bids
    const { error: bidsError } = await supabase
      .from('bids')
      .delete()
      .eq('player_id', playerId)
    
    if (bidsError) {
      logger.error('Errore cancellazione offerte:', bidsError)
      throw new Error('Errore cancellazione offerte')
    }

    // Deactivate timers
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
    
    // Determine auction result
    const result = await determineAuctionResult(supabase, validBids, currentTurnParticipant, playerId)
    
    // Broadcast realtime event
    await broadcastAuctionClosed(supabase, auctionData.player, result, allBidsData)
    
    // Cleanup
    await cleanupAuction(supabase, playerId, roomId)
    
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