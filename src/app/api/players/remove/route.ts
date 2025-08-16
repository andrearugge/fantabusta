import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { playerId, participantId } = await request.json()
    
    if (!playerId || !participantId) {
      return NextResponse.json(
        { error: 'Parametri mancanti' },
        { status: 400 }
      )
    }

    const supabase = await createClient()
    
    // Recupera il giocatore e il prezzo di acquisto
    const { data: player } = await supabase
      .from('players')
      .select('*')
      .eq('id', playerId)
      .eq('assigned_to', participantId)
      .single()
    
    if (!player) {
      return NextResponse.json(
        { error: 'Giocatore non trovato o non assegnato a questo partecipante' },
        { status: 404 }
      )
    }

    // Recupera il prezzo di acquisto dalle offerte
    const { data: winningBid } = await supabase
      .from('bids')
      .select('amount')
      .eq('player_id', playerId)
      .eq('participant_id', participantId)
      .order('amount', { ascending: false })
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()
    
    const refundAmount = winningBid?.amount || 0

    // Recupera il budget attuale del partecipante
    const { data: participant } = await supabase
      .from('participants')
      .select('budget')
      .eq('id', participantId)
      .single()
    
    if (!participant) {
      return NextResponse.json(
        { error: 'Partecipante non trovato' },
        { status: 404 }
      )
    }

    // Rimuovi il giocatore dal team (rendi disponibile)
    const { error: playerError } = await supabase
      .from('players')
      .update({
        is_assigned: false,
        assigned_to: null
      })
      .eq('id', playerId)
    
    if (playerError) {
      console.error('Errore rimozione giocatore:', playerError)
      return NextResponse.json(
        { error: 'Errore rimozione giocatore' },
        { status: 500 }
      )
    }

    // Restituisci i crediti al partecipante
    const { error: budgetError } = await supabase
      .from('participants')
      .update({
        budget: participant.budget + refundAmount
      })
      .eq('id', participantId)
    
    if (budgetError) {
      console.error('Errore aggiornamento budget:', budgetError)
      return NextResponse.json(
        { error: 'Errore aggiornamento budget' },
        { status: 500 }
      )
    }

    // Invia evento realtime per aggiornare le interfacce
    await supabase
      .channel('team_updates')
      .send({
        type: 'broadcast',
        event: 'player_removed',
        payload: {
          playerId,
          participantId,
          refundAmount,
          playerName: player.nome
        }
      })

    return NextResponse.json({
      success: true,
      refundAmount,
      message: `${player.nome} rimosso dal team. ${refundAmount}M restituiti.`
    })
    
  } catch (error) {
    console.error('Errore API remove player:', error)
    return NextResponse.json(
      { error: 'Errore interno del server' },
      { status: 500 }
    )
  }
}