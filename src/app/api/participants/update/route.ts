import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function PUT(request: NextRequest) {
  try {
    const { participantId, displayName } = await request.json()
    
    if (!participantId || !displayName) {
      return NextResponse.json(
        { error: 'ID partecipante e nome richiesti' },
        { status: 400 }
      )
    }
    
    if (displayName.trim().length === 0) {
      return NextResponse.json(
        { error: 'Il nome non può essere vuoto' },
        { status: 400 }
      )
    }

    const supabase = await createClient()
    
    // Aggiorna il nome del partecipante
    const { data, error } = await supabase
      .from('participants')
      .update({ display_name: displayName.trim() })
      .eq('id', participantId)
      .select()
      .single()
    
    if (error) {
      console.error('Errore aggiornamento partecipante:', error)
      return NextResponse.json(
        { error: 'Errore aggiornamento partecipante' },
        { status: 500 }
      )
    }

    return NextResponse.json({ 
      success: true, 
      participant: data 
    })
    
  } catch (error) {
    console.error('Errore server:', error)
    return NextResponse.json(
      { error: 'Errore interno del server' },
      { status: 500 }
    )
  }
}