import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST() {
  try {
    const supabase = await createClient()
    
    // Trova e disattiva tutti i timer scaduti
    const { data: expiredTimers, error: findError } = await supabase
      .from('auction_timers')
      .select('*')
      .eq('is_active', true)
      .lt('end_time', new Date().toISOString())
    
    if (findError) {
      console.error('Errore ricerca timer scaduti:', findError)
      return NextResponse.json({ error: 'Errore ricerca timer' }, { status: 500 })
    }
    
    if (expiredTimers && expiredTimers.length > 0) {
      // Disattiva i timer scaduti
      const { error: updateError } = await supabase
        .from('auction_timers')
        .update({ is_active: false })
        .eq('is_active', true)
        .lt('end_time', new Date().toISOString())
      
      if (updateError) {
        console.error('Errore disattivazione timer:', updateError)
        return NextResponse.json({ error: 'Errore disattivazione timer' }, { status: 500 })
      }
      
      // Per ogni timer scaduto, chiama l'API di chiusura asta
      for (const timer of expiredTimers) {
        try {
          const closeResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/auction/close`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              roomId: timer.room_id, 
              playerId: timer.player_id 
            })
          })
          
          if (!closeResponse.ok) {
            console.error(`Errore chiusura asta per timer ${timer.id}`)
          }
        } catch (error) {
          console.error(`Errore chiamata API chiusura per timer ${timer.id}:`, error)
        }
      }
      
      return NextResponse.json({ 
        message: `${expiredTimers.length} timer scaduti disattivati`,
        expiredTimers 
      })
    }
    
    return NextResponse.json({ message: 'Nessun timer scaduto trovato' })
  } catch (error) {
    console.error('Errore check-timers:', error)
    return NextResponse.json({ error: 'Errore interno' }, { status: 500 })
  }
}