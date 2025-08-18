import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@/lib/logger'

export async function POST(request: NextRequest) {
  try {
    const { room_id } = await request.json()

    if (!room_id) {
      return NextResponse.json(
        { error: 'Room ID è richiesto' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // Recupera i dati della room e i partecipanti
    const { data: room, error: roomError } = await supabase
      .from('rooms')
      .select('current_turn')
      .eq('id', room_id)
      .single()

    if (roomError) {
      logger.error('Errore recupero room:', roomError)
      return NextResponse.json(
        { error: 'Errore nel recupero della room' },
        { status: 500 }
      )
    }

    const { data: participants, error: participantsError } = await supabase
      .from('participants')
      .select('*')
      .eq('room_id', room_id)
      .order('turn_order')

    if (participantsError) {
      logger.error('Errore recupero partecipanti:', participantsError)
      return NextResponse.json(
        { error: 'Errore nel recupero dei partecipanti' },
        { status: 500 }
      )
    }

    // Calcola il prossimo turno - CORRETTO per gestire turn_order che iniziano da 0
    const currentTurn = room.current_turn ?? 0  // Usa 0 come default invece di 1
    const nextTurn = (currentTurn + 1) % participants.length  // Usa modulo per ciclare correttamente da 0 a N-1

    // Aggiorna il turno nel database
    const { error: updateError } = await supabase
      .from('rooms')
      .update({ current_turn: nextTurn })
      .eq('id', room_id)

    if (updateError) {
      logger.error('Errore aggiornamento turno:', updateError)
      return NextResponse.json(
        { error: 'Errore nell\'aggiornamento del turno' },
        { status: 500 }
      )
    }

    // Invia broadcast del cambio turno con convenzione camelCase
    const channel = supabase.channel(`room-${room_id}`)
    await channel.send({
      type: 'broadcast',
      event: 'turn_changed',
      payload: {
        roomId: room_id,
        newTurn: nextTurn,
        previousTurn: currentTurn
      }
    })

    logger.info(`Turno saltato nella room ${room_id}: ${currentTurn} -> ${nextTurn}`)

    return NextResponse.json({
      success: true,
      previousTurn: currentTurn,
      newTurn: nextTurn
    })

  } catch (error) {
    logger.error('Errore nel saltare il turno:', error)
    return NextResponse.json(
      { error: 'Errore interno del server' },
      { status: 500 }
    )
  }
}