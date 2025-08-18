import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@/lib/logger'

export async function POST(request: NextRequest) {
  try {
    const { roomId, playerId, participantId, currentTurn } = await request.json()
    
    // Validation
    if (!roomId || !playerId || !participantId) {
      return NextResponse.json(
        { error: 'Parametri mancanti' },
        { status: 400 }
      )
    }

    const supabase = await createClient()
    
    // Verifica che non ci sia già un'asta attiva usando auction_timers
    const { data: existingTimer } = await supabase
      .from('auction_timers')
      .select('id')
      .eq('room_id', roomId)
      .eq('is_active', true)
      .single()
    
    if (existingTimer) {
      return NextResponse.json(
        { error: 'Asta già in corso' },
        { status: 409 }
      )
    }

    // Recupera dati del giocatore
    const { data: player, error: playerError } = await supabase
      .from('players')
      .select('*')
      .eq('id', playerId)
      .eq('room_id', roomId)
      .eq('is_assigned', false)
      .single()

    if (playerError || !player) {
      return NextResponse.json(
        { error: 'Giocatore non trovato o già assegnato' },
        { status: 404 }
      )
    }

    // Verifica che sia il turno del partecipante
    const { data: roomData, error: roomError } = await supabase
      .from('rooms')
      .select('current_turn')
      .eq('id', roomId)
      .single()

    if (roomError || roomData.current_turn !== currentTurn) {
      return NextResponse.json(
        { error: 'Non è il tuo turno' },
        { status: 403 }
      )
    }

    // Verifica che il partecipante sia quello di turno
    const { data: participant, error: participantError } = await supabase
      .from('participants')
      .select('turn_order')
      .eq('id', participantId)
      .eq('room_id', roomId)
      .single()

    if (participantError || participant.turn_order !== currentTurn) {
      return NextResponse.json(
        { error: 'Non autorizzato per questo turno' },
        { status: 403 }
      )
    }

    // Crea nuovo timer di asta usando auction_timers
    const timerDuration = parseInt(process.env.NEXT_PUBLIC_TIMER || '30')
    const startTime = new Date()
    const endTime = new Date(startTime.getTime() + timerDuration * 1000)

    const { data: timer, error: timerError } = await supabase
      .from('auction_timers')
      .insert({
        room_id: roomId,
        player_id: playerId,
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString(),
        is_active: true
      })
      .select()
      .single()

    if (timerError) {
      logger.error('Errore creazione timer asta:', timerError)
      return NextResponse.json(
        { error: 'Errore creazione asta' },
        { status: 500 }
      )
    }

    // Avvia timer server-side
    startServerTimer(supabase, endTime.getTime(), roomId, playerId)

    // Broadcast evento realtime
    await supabase
      .channel('auction_events')
      .send({
        type: 'broadcast',
        event: 'player_selected',
        payload: {
          timer,
          player,
          currentTurn,
          auctionEndTime: endTime.getTime(),
          timeRemaining: timerDuration,
          duration: timerDuration
        }
      })

    logger.info('Asta avviata con successo', {
      timerId: timer.id,
      playerId,
      participantId,
      roomId
    })

    return NextResponse.json({ 
      success: true, 
      timerId: timer.id,
      endTime: endTime.toISOString()
    })
    
  } catch (error) {
    logger.error('Errore API start auction:', error)
    return NextResponse.json(
      { error: 'Errore interno del server' },
      { status: 500 }
    )
  }
}

// Importa la logica di chiusura asta
async function closeAuction(roomId: string, playerId: string) {
  const supabase = await createClient()
  
  // Recupera le offerte per questo giocatore
  const { data: bids } = await supabase
    .from('bids')
    .select(`
      *,
      participants!inner(
        id,
        display_name,
        budget
      )
    `)
    .eq('player_id', playerId)
    .order('amount', { ascending: false })

  let winner = null
  let winningBid = 0

  if (bids && bids.length > 0) {
    const highestBid = bids[0]
    winner = highestBid.participants
    winningBid = highestBid.amount

    // Aggiorna budget del vincitore
    await supabase
      .from('participants')
      .update({ budget: winner.budget - winningBid })
      .eq('id', winner.id)

    // Assegna il giocatore
    await supabase
      .from('players')
      .update({ 
        is_assigned: true,
        assigned_to: winner.id 
      })
      .eq('id', playerId)
  }

  // Recupera i dati del giocatore
  const { data: player } = await supabase
    .from('players')
    .select('*')
    .eq('id', playerId)
    .single()

  // Invia evento realtime
  await supabase
    .channel('auction_events')
    .send({
      type: 'broadcast',
      event: 'auction_closed',
      payload: {
        player,
        winner,
        winningBid,
        allBids: bids?.map(bid => ({
          participant_name: bid.participants.display_name,
          amount: bid.amount
        })) || []
      }
    })

  // Cancella le offerte
  await supabase
    .from('bids')
    .delete()
    .eq('player_id', playerId)

  // NUOVO: Disattiva i timer per questo giocatore
  await supabase
    .from('auction_timers')
    .update({ is_active: false })
    .eq('player_id', playerId)
    .eq('room_id', roomId)
    .eq('is_active', true)
}

// Funzione per gestire timer server-side
function startServerTimer(supabase: any, endTime: number, roomId: string, playerId: string) {
  const interval = setInterval(async () => {
    const now = Date.now()
    const timeRemaining = Math.max(0, Math.ceil((endTime - now) / 1000))
    
    // Broadcast aggiornamento timer
    await supabase
      .channel('auction_events')
      .send({
        type: 'broadcast',
        event: 'timer_update',
        payload: { timeRemaining }
      })
    
    // Se il tempo è scaduto, chiudi l'asta
    if (timeRemaining <= 0) {
      clearInterval(interval)
      
      // Chiama direttamente la funzione di chiusura
      await closeAuction(roomId, playerId)
    }
  }, 1000)
}