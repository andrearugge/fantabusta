import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import TeamsView from '@/components/teams/TeamsView'

interface TeamsPageProps {
  params: {
    room: string
  }
}

export default async function TeamsPage({ params }: TeamsPageProps) {
  const supabase = await createClient()
  
  const { room } = await params
  
  // Recupera dati asta
  const { data: roomData } = await supabase
    .from('rooms')
    .select('*')
    .eq('code', room)
    .single()

  if (!roomData) {
    notFound()
  }

  // Recupera partecipanti
  const { data: participants } = await supabase
    .from('participants')
    .select('*')
    .eq('room_id', roomData.id)
    .order('display_name')

  // Recupera calciatori assegnati con partecipanti
  const { data: assignedPlayersData } = await supabase
    .from('players')
    .select(`
      *,
      participants!assigned_to (
        id,
        display_name
      )
    `)
    .eq('room_id', roomData.id)
    .eq('is_assigned', true)
    .not('assigned_to', 'is', null)

  // Per ogni giocatore assegnato, recupera l'offerta vincente
  const assignedPlayers = await Promise.all(
    (assignedPlayersData || []).map(async (player) => {
      const { data: winningBid } = await supabase
        .from('bids')
        .select('amount')
        .eq('player_id', player.id)
        .eq('participant_id', player.assigned_to)
        .order('amount', { ascending: false })
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle()
      
      return {
        ...player,
        purchase_price: winningBid?.amount || 0
      }
    })
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <TeamsView 
          room={roomData}
          participants={participants || []}
          assignedPlayers={assignedPlayers || []}
        />
      </div>
    </div>
  )
}