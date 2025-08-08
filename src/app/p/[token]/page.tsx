import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import ParticipantPortal from '@/components/participant/ParticipantPortal'

interface ParticipantPageProps {
  params: {
    token: string
  }
}

export default async function ParticipantPage({ params }: ParticipantPageProps) {
  const supabase = await createClient()
  
  // Await params before using its properties
  const { token } = await params
  
  // Trova partecipante dal token
  const { data: participant } = await supabase
    .from('participants')
    .select(`
      *,
      rooms (*)
    `)
    .eq('join_token', token)
    .single()

  if (!participant) {
    notFound()
  }

  // Recupera i calciatori del partecipante
  const { data: myPlayers } = await supabase
    .from('players')
    .select('*')
    .eq('assigned_to', participant.id)
    .order('nome')

  // Conta calciatori per ruolo
  const playerCounts = {
    P: myPlayers?.filter(p => p.ruolo === 'P').length || 0,
    D: myPlayers?.filter(p => p.ruolo === 'D').length || 0,
    C: myPlayers?.filter(p => p.ruolo === 'C').length || 0,
    A: myPlayers?.filter(p => p.ruolo === 'A').length || 0
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="container mx-auto px-4 py-8">
        <ParticipantPortal 
          participant={participant}
          myPlayers={myPlayers || []}
          playerCounts={playerCounts}
        />
      </div>
    </div>
  )
}