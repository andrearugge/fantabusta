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
  
  try {
    // Recupera il timer attivo per questo giocatore
    const { data: activeTimer, error: timerError } = await supabase
      .from('auction_timers')
      .select('id')
      .eq('player_id', playerId)
      .eq('room_id', roomId)
      .eq('is_active', true)
      .single()
    
    if (timerError) {
      logger.error('Errore recupero timer attivo:', timerError)
      return
    }

    // Recupera le offerte per questo auction_timer_id
    const { data: bids, error: bidsError } = await supabase
      .from('bids')
      .select(`
        *,
        participants!participant_id (
          id,
          display_name,
          budget
        )
      `)
      .eq('auction_timer_id', activeTimer.id)
      .order('amount', { ascending: false })
      .order('created_at', { ascending: true })

    if (bidsError) {
      logger.error('Errore recupero offerte:', bidsError)
      return
    }

    let winner = null
    let winningBid = 0

    // Filtra le bid valide (amount > 0)
    const validBids = bids?.filter(bid => bid.amount > 0) || []

    if (validBids.length > 0) {
      const highestBid = validBids[0]
      winner = highestBid.participants
      winningBid = highestBid.amount

      // Aggiorna budget del vincitore
      await supabase
        .from('participants')
        .update({ budget: winner.budget - winningBid })
        .eq('id', winner.id)

      // Assegna il giocatore CON purchase_price
      const { data: updateData, error: playerError } = await supabase
        .from('players')
        .update({ 
          is_assigned: true,
          assigned_to: winner.id,
          purchase_price: winningBid
        })
        .eq('id', playerId)
        .select()
      
      if (playerError) {
        logger.error('Errore assegnazione giocatore:', playerError)
      } else {
        logger.info('Giocatore assegnato con successo', {
          playerId,
          winnerId: winner.id,
          purchase_price: winningBid
        })
      }

      // Crea record bid per lo storico
      await supabase
        .from('bids')
        .insert({
          player_id: playerId,
          participant_id: winner.id,
          amount: winningBid,
          auction_timer_id: activeTimer.id,
          room_id: roomId
        })
    }

    // Recupera i dati del giocatore aggiornati
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
            participant_name: bid.participants?.display_name,
            amount: bid.amount
          })) || []
        }
      })

    // Disattiva i timer per questo giocatore
    await supabase
      .from('auction_timers')
      .update({ is_active: false })
      .eq('player_id', playerId)
      .eq('room_id', roomId)
      .eq('is_active', true)
      
    // AGGIUNTA: Passa automaticamente al turno successivo
    await skipTurnAfterAuction(supabase, roomId)
      
    logger.info('Asta chiusa automaticamente', { roomId, playerId, winner: winner?.display_name, winningBid })
    
  } catch (error) {
    logger.error('Errore chiusura asta automatica:', error)
  }
}

// Funzione per passare al turno successivo dopo l'asta
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

    // Invia broadcast del cambio turno
    await supabase
      .channel(`room-${roomId}`)
      .send({
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
      
      logger.info('Timer scaduto, chiudendo asta', { roomId, playerId })
      
      // Chiama direttamente la funzione di chiusura invece di fare una fetch
      try {
        await closeAuction(roomId, playerId)
        logger.info('Asta chiusa automaticamente', { roomId, playerId })
      } catch (error) {
        logger.error('Errore chiusura automatica asta', { error, roomId, playerId })
      }
    }
  }, 1000)}