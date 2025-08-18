import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { CSVPlayer } from '@/types'

export async function POST(request: NextRequest) {
  try {
    const { roomId, players } = await request.json()
    
    if (!roomId || !players || !Array.isArray(players)) {
      return NextResponse.json(
        { error: 'Parametri mancanti o non validi' },
        { status: 400 }
      )
    }

    if (players.length === 0) {
      return NextResponse.json(
        { error: 'Lista calciatori richiesta' },
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

    // Verifica che l'asta non sia in corso
    if (room.status === 'active') {
      return NextResponse.json(
        { error: 'Impossibile re-importare durante un\'asta attiva' },
        { status: 400 }
      )
    }

    // Inizia transazione: cancella tutti i giocatori esistenti
    const { error: deleteError } = await supabase
      .from('players')
      .delete()
      .eq('room_id', roomId)
    
    if (deleteError) {
      console.error('Errore cancellazione giocatori:', deleteError)
      return NextResponse.json(
        { error: 'Errore cancellazione giocatori esistenti' },
        { status: 500 }
      )
    }

    // Cancella anche tutte le offerte associate
    const { error: deleteBidsError } = await supabase
      .from('bids')
      .delete()
      .eq('room_id', roomId)
    
    if (deleteBidsError) {
      console.error('Errore cancellazione offerte:', deleteBidsError)
      return NextResponse.json(
        { error: 'Errore cancellazione offerte esistenti' },
        { status: 500 }
      )
    }

    // Inserisci i nuovi giocatori
    const playersData = players.map((player: CSVPlayer) => ({
      room_id: roomId,
      nome: player.nome,
      ruolo: player.ruolo,
      squadra: player.squadra,
      player_id: player.player_id,
      is_assigned: false
    }))

    const { error: playersError } = await supabase
      .from('players')
      .insert(playersData)
    
    if (playersError) {
      console.error('Errore inserimento nuovi giocatori:', playersError)
      return NextResponse.json(
        { error: 'Errore caricamento nuovi giocatori' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: `${players.length} giocatori re-importati con successo`,
      playersCount: players.length
    })
    
  } catch (error) {
    console.error('Errore API reimport players:', error)
    return NextResponse.json(
      { error: 'Errore interno del server' },
      { status: 500 }
    )
  }
}