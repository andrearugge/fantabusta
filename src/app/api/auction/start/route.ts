import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { roomId, playerId, currentTurn } = await request.json()
    
    if (!roomId || !playerId) {
      return NextResponse.json(
        { error: 'Parametri mancanti' },
        { status: 400 }
      )
    }

    const supabase = await createClient()
    
    // Verifica che il calciatore non sia già assegnato
    const { data: player, error: playerError } = await supabase
      .from('players')
      .select('*')
      .eq('id', playerId)
      .eq('is_assigned', false)
      .single()
    
    if (playerError || !player) {
      return NextResponse.json(
        { error: 'Calciatore non disponibile' },
        { status: 400 }
      )
    }

    // Cancella eventuali offerte precedenti per questo calciatore
    // await supabase
    //   .from('bids')
    //   .delete()
    //   .eq('player_id', playerId)

    // Calcola timestamp di fine asta (30 secondi da ora)
    const auctionEndTime = Date.now() + 30000

    // Invia evento realtime a tutti i partecipanti con timestamp di fine
    await supabase
      .channel('auction_events')
      .send({
        type: 'broadcast',
        event: 'player_selected',
        payload: {
          player,
          currentTurn,
          auctionEndTime,
          timeRemaining: 30
        }
      })

    // Avvia timer server-side per broadcast periodici
    startServerTimer(supabase, auctionEndTime, roomId, playerId)

    return NextResponse.json({ success: true })
    
  } catch (error) {
    console.error('Errore API start auction:', error)
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
  // await supabase
  //   .from('bids')
  //   .delete()
  //   .eq('player_id', playerId)
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