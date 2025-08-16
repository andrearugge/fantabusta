import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { playerId, participantId, price } = await request.json()
    
    if (!playerId || !participantId || price < 0) {
      return NextResponse.json(
        { error: 'Parametri non validi' },
        { status: 400 }
      )
    }

    const supabase = await createClient()
    
    // Verifica che il giocatore sia disponibile
    const { data: player } = await supabase
      .from('players')
      .select('*')
      .eq('id', playerId)
      .eq('is_assigned', false)
      .single()
    
    if (!player) {
      return NextResponse.json(
        { error: 'Giocatore non disponibile o già assegnato' },
        { status: 404 }
      )
    }

    // Verifica budget partecipante
    const { data: participant } = await supabase
      .from('participants')
      .select('budget, display_name')
      .eq('id', participantId)
      .single()
    
    if (!participant || participant.budget < price) {
      return NextResponse.json(
        { error: 'Budget insufficiente' },
        { status: 400 }
      )
    }

    // Verifica vincoli di ruolo
    const { data: participantPlayers } = await supabase
      .from('players')
      .select('ruolo')
      .eq('assigned_to', participantId)
    
    const roleCounts = {
      P: participantPlayers?.filter(p => p.ruolo === 'P').length || 0,
      D: participantPlayers?.filter(p => p.ruolo === 'D').length || 0,
      C: participantPlayers?.filter(p => p.ruolo === 'C').length || 0,
      A: participantPlayers?.filter(p => p.ruolo === 'A').length || 0
    }

    const maxRoles = { P: 3, D: 8, C: 8, A: 6 }
    if (roleCounts[player.ruolo as keyof typeof roleCounts] >= maxRoles[player.ruolo as keyof typeof maxRoles]) {
      return NextResponse.json(
        { error: `Limite ruolo ${player.ruolo} raggiunto (${maxRoles[player.ruolo as keyof typeof maxRoles]} max)` },
        { status: 400 }
      )
    }

    // Assegna il giocatore
    const { error: assignError } = await supabase
      .from('players')
      .update({
        is_assigned: true,
        assigned_to: participantId
      })
      .eq('id', playerId)
    
    if (assignError) {
      console.error('Errore assegnazione giocatore:', assignError)
      return NextResponse.json(
        { error: 'Errore assegnazione giocatore' },
        { status: 500 }
      )
    }

    // Aggiorna budget partecipante
    const { error: budgetError } = await supabase
      .from('participants')
      .update({
        budget: participant.budget - price
      })
      .eq('id', participantId)
    
    if (budgetError) {
      console.error('Errore aggiornamento budget:', budgetError)
      return NextResponse.json(
        { error: 'Errore aggiornamento budget' },
        { status: 500 }
      )
    }

    // Crea record bid per tracciare l'acquisto
    const { error: bidError } = await supabase
      .from('bids')
      .insert({
        room_id: player.room_id,
        player_id: playerId,
        participant_id: participantId,
        amount: price
      })
    
    if (bidError) {
      console.error('Errore creazione bid:', bidError)
      // Non blocchiamo l'operazione per questo errore
    }

    // Invia evento realtime
    await supabase
      .channel('team_updates')
      .send({
        type: 'broadcast',
        event: 'player_assigned',
        payload: {
          playerId,
          participantId,
          price,
          playerName: player.nome,
          participantName: participant.display_name
        }
      })

    return NextResponse.json({
      success: true,
      message: `${player.nome} assegnato a ${participant.display_name} per ${price}M`
    })
    
  } catch (error) {
    console.error('Errore API assign player:', error)
    return NextResponse.json(
      { error: 'Errore interno del server' },
      { status: 500 }
    )
  }
}