import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const supabase = await createClient()
    
    // Recupera aste attive con conteggio partecipanti
    const { data: rooms, error } = await supabase
      .from('rooms')
      .select(`
        id,
        code,
        status,
        budget_default,
        created_at,
        participants:participants(count)
      `)
      .in('status', ['setup', 'active', 'paused'])
      .order('created_at', { ascending: false })
    
    if (error) {
      console.error('Errore recupero aste:', error)
      return NextResponse.json(
        { error: 'Errore recupero aste' },
        { status: 500 }
      )
    }

    return NextResponse.json({ rooms })
    
  } catch (error) {
    console.error('Errore API list rooms:', error)
    return NextResponse.json(
      { error: 'Errore interno del server' },
      { status: 500 }
    )
  }
}