import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { roomId, playerId, participantId, amount } = await request.json()
    
    if (!roomId || !playerId || !participantId || amount < 0) {
      return NextResponse.json(
        { error: 'Parametri non validi' },
        { status: 400 }
      )
    }

    const supabase = await createClient()
    
    // Verifica budget partecipante
    const { data: participant } = await supabase
      .from('participants')
      .select('budget, display_name')
      .eq('id', participantId)
      .single()
    
    if (!participant || participant.budget < amount) {
      return NextResponse.json(
        { error: 'Budget insufficiente' },
        { status: 400 }
      )
    }

    // Verifica che il calciatore sia ancora disponibile
    const { data: player } = await supabase
      .from('players')
      .select('ruolo, is_assigned')
      .eq('id', playerId)
      .single()
    
    if (!player || player.is_assigned) {
      return NextResponse.json(
        { error: 'Calciatore non più disponibile' },
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
        { error: 'Limite ruolo raggiunto' },
        { status: 400 }
      )
    }

    // Inserisci/aggiorna offerta
    const { error: upsertError } = await supabase
      .from('bids')
      .upsert({
        room_id: roomId,  // ← Questo campo mancava!
        participant_id: participantId,
        player_id: playerId,
        amount: amount
      })

    if (upsertError) {
      console.error('Errore inserimento offerta:', upsertError)
      return NextResponse.json(
        { error: 'Errore inserimento offerta' },
        { status: 500 }
      )
    }

    // Broadcast bid update
    await supabase
      .channel('bid_updates')
      .send({
        type: 'broadcast',
        event: 'bid_placed',
        payload: {
          player_id: playerId,
          participant_name: participant.display_name,
          amount: amount
        }
      })

    return NextResponse.json({ success: true })
    
  } catch (error) {
    console.error('Errore API place bid:', error)
    return NextResponse.json(
      { error: 'Errore interno del server' },
      { status: 500 }
    )
  }
}