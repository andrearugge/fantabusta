import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { nanoid } from 'nanoid'

export async function POST(request: NextRequest) {
  try {
    const { participants, budget, players } = await request.json()
    
    if (!participants || participants.length < 6 || participants.length > 10) {
      return NextResponse.json(
        { error: 'Numero partecipanti non valido (6-10)' },
        { status: 400 }
      )
    }
    
    if (!players || players.length === 0) {
      return NextResponse.json(
        { error: 'Lista calciatori richiesta' },
        { status: 400 }
      )
    }

    const supabase = await createClient()
    
    // Genera codice asta univoco
    const roomCode = nanoid(8).toUpperCase()
    
    // Crea asta
    const { data: room, error: roomError } = await supabase
      .from('rooms')
      .insert({
        code: roomCode,
        status: 'setup',
        budget_default: budget || 500
      })
      .select()
      .single()
    
    if (roomError) {
      console.error('Errore creazione room:', roomError)
      return NextResponse.json(
        { error: 'Errore creazione asta' },
        { status: 500 }
      )
    }

    // Crea partecipanti con token univoci
    const participantsData = participants.map((name: string, index: number) => {
      const token = nanoid(16)
      return {
        room_id: room.id,
        display_name: name,
        budget: budget || 500,
        join_token: token,
        join_url: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/p/${token}`,
        turn_order: index
      }
    })

    const { data: createdParticipants, error: participantsError } = await supabase
      .from('participants')
      .insert(participantsData)
      .select()
    
    if (participantsError) {
      console.error('Errore creazione partecipanti:', participantsError)
      return NextResponse.json(
        { error: 'Errore creazione partecipanti' },
        { status: 500 }
      )
    }

    // Crea calciatori
    const playersData = players.map((player: any) => ({
      room_id: room.id,
      nome: player.nome,
      ruolo: player.ruolo,
      squadra: player.squadra,
      is_assigned: false
    }))

    const { error: playersError } = await supabase
      .from('players')
      .insert(playersData)
    
    if (playersError) {
      console.error('Errore creazione calciatori:', playersError)
      return NextResponse.json(
        { error: 'Errore caricamento calciatori' },
        { status: 500 }
      )
    }

    // Aggiorna status asta
    await supabase
      .from('rooms')
      .update({ status: 'active' })
      .eq('id', room.id)

    return NextResponse.json({
      success: true,
      roomCode: room.code,
      participants: createdParticipants
    })
    
  } catch (error) {
    console.error('Errore API create room:', error)
    return NextResponse.json(
      { error: 'Errore interno del server' },
      { status: 500 }
    )
  }
}