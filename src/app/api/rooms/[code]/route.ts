import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  request: NextRequest,
  { params }: { params: { code: string } }
) {
  try {
    const { code } = await params
    const supabase = await createClient()
    
    // Recupera room con partecipanti
    const { data: room, error: roomError } = await supabase
      .from('rooms')
      .select(`
        id,
        code,
        status,
        budget_default,
        created_at,
        participants(
          id,
          display_name,
          join_token,
          join_url,
          turn_order
        )
      `)
      .eq('code', code)
      .single()
    
    if (roomError || !room) {
      return NextResponse.json(
        { error: 'Asta non trovata' },
        { status: 404 }
      )
    }

    return NextResponse.json({ room })
    
  } catch (error) {
    console.error('Errore API get room:', error)
    return NextResponse.json(
      { error: 'Errore interno del server' },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { code: string } }
) {
  try {
    const { code } = await params
    const { name } = await request.json()
    
    if (!name || name.trim().length === 0) {
      return NextResponse.json(
        { error: 'Nome room richiesto' },
        { status: 400 }
      )
    }

    const supabase = await createClient()
    
    // Aggiorna nome room (usando il campo code come nome)
    const { error } = await supabase
      .from('rooms')
      .update({ code: name.trim() })
      .eq('code', code)
    
    if (error) {
      console.error('Errore aggiornamento room:', error)
      return NextResponse.json(
        { error: 'Errore aggiornamento room' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
    
  } catch (error) {
    console.error('Errore API update room:', error)
    return NextResponse.json(
      { error: 'Errore interno del server' },
      { status: 500 }
    )
  }
}