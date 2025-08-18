import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { roomId, action } = await request.json()
    
    if (!roomId || !action) {
      return NextResponse.json(
        { error: 'Parametri mancanti' },
        { status: 400 }
      )
    }

    if (!['pause', 'resume'].includes(action)) {
      return NextResponse.json(
        { error: 'Azione non valida' },
        { status: 400 }
      )
    }

    const supabase = await createClient()
    
    // Verifica che la room esista
    const { data: room, error: roomError } = await supabase
      .from('rooms')
      .select('id, status')
      .eq('id', roomId)
      .single()

    if (roomError || !room) {
      return NextResponse.json(
        { error: 'Asta non trovata' },
        { status: 404 }
      )
    }

    // Determina il nuovo status
    let newStatus: string
    if (action === 'pause') {
      if (room.status !== 'active') {
        return NextResponse.json(
          { error: 'Solo le aste attive possono essere messe in pausa' },
          { status: 400 }
        )
      }
      newStatus = 'paused'
      
      // Disattiva tutti i timer attivi per questa room
      await supabase
        .from('auction_timers')
        .update({ is_active: false })
        .eq('room_id', roomId)
        .eq('is_active', true)
        
    } else { // resume
      if (room.status !== 'paused') {
        return NextResponse.json(
          { error: 'Solo le aste in pausa possono essere riprese' },
          { status: 400 }
        )
      }
      newStatus = 'active'
    }

    // Aggiorna lo status della room
    const { error: updateError } = await supabase
      .from('rooms')
      .update({ status: newStatus })
      .eq('id', roomId)

    if (updateError) {
      console.error('Errore aggiornamento status:', updateError)
      return NextResponse.json(
        { error: 'Errore aggiornamento status' },
        { status: 500 }
      )
    }

    // Invia evento realtime per notificare tutti i client
    await supabase
      .channel('auction_events')
      .send({
        type: 'broadcast',
        event: 'auction_status_changed',
        payload: {
          roomId,
          status: newStatus,
          action
        }
      })

    return NextResponse.json({
      success: true,
      status: newStatus,
      message: action === 'pause' ? 'Asta messa in pausa' : 'Asta ripresa'
    })

  } catch (error) {
    console.error('Errore API pause:', error)
    return NextResponse.json(
      { error: 'Errore interno del server' },
      { status: 500 }
    )
  }
}