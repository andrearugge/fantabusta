import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { roomId, playerId } = await request.json()
    
    if (!roomId || !playerId) {
      return NextResponse.json(
        { error: 'Parametri mancanti' },
        { status: 400 }
      )
    }

    const supabase = await createClient()
    
    // Recupera tutte le offerte per questo calciatore
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
    
    // Recupera il timestamp di inizio dell'asta corrente
    // Assumendo che l'asta sia iniziata quando è stato inviato l'evento player_selected
    // Per ora useremo un approccio semplificato: calcolare dal primo bid
    let auctionStartTime: Date | null = null
    if (bids && bids.length > 0) {
      // Trova il timestamp del primo bid come riferimento per l'inizio dell'asta
      const sortedByTime = [...bids].sort((a, b) => 
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      )
      // Sottrai 30 secondi dal primo bid per stimare l'inizio dell'asta
      auctionStartTime = new Date(new Date(sortedByTime[0].created_at).getTime() - 30000)
    }
    
    if (bidsError) {
      console.error('Errore recupero offerte:', bidsError)
      return NextResponse.json(
        { error: 'Errore recupero offerte' },
        { status: 500 }
      )
    }

    let winner = null
    let winningBid = 0
    
    if (bids && bids.length > 0) {
      // Filtra offerte > 0
      const validBids = bids.filter(bid => bid.amount > 0)
      
      if (validBids.length > 0) {
        // Trova offerta vincente (più alta, in caso di pareggio la prima)
        winner = validBids[0]
        winningBid = winner.amount
        
        // Assegna calciatore al vincitore
        // Assegna il giocatore
        await supabase
          .from('players')
          .update({ 
            is_assigned: true,
            assigned_to: winner.participant_id,
            purchase_price: winningBid
          })
          .eq('id', playerId)
        
        // Recupera il budget attuale del vincitore
        const { data: participant } = await supabase
          .from('participants')
          .select('budget')
          .eq('id', winner.participant_id)
          .single()
        
        if (participant) {
          // Calcola il nuovo budget
          const newBudget = participant.budget - winningBid
          
          // Aggiorna budget vincitore
          await supabase
            .from('participants')
            .update({
              budget: newBudget
            })
            .eq('id', winner.participant_id)
        }
      }
    }

    // Recupera dati calciatore per l'evento
    const { data: player } = await supabase
      .from('players')
      .select('*')
      .eq('id', playerId)
      .single()

    // Prepara dati per evento realtime
    const allBidsData = bids?.map(bid => {
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
    }) || []

    // Invia evento realtime
    await supabase
      .channel('auction_events')
      .send({
        type: 'broadcast',
        event: 'auction_closed',
        payload: {
          player,
          winner: winner ? {
            display_name: winner.participants?.display_name,
            participant_id: winner.participant_id
          } : null,
          winningBid,
          allBids: allBidsData
        }
      })

    // Cancellazione offerte
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

    return NextResponse.json({
      success: true,
      winner,
      winningBid,
      totalBids: bids?.length || 0
    })
    
  } catch (error) {
    console.error('Errore API close auction:', error)
    return NextResponse.json(
      { error: 'Errore interno del server' },
      { status: 500 }
    )
  }
}