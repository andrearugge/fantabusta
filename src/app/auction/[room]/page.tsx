import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import AuctionAdmin from '@/components/auction/AuctionAdmin'

interface AuctionPageProps {
  params: {
    room: string
  }
}

export default async function AuctionPage({ params }: AuctionPageProps) {
  const supabase = await createClient()
  
  // Await params prima di usarlo
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
    .order('turn_order')

  // Recupera calciatori
  const { data: players } = await supabase
    .from('players')
    .select('*')
    .eq('room_id', roomData.id)
    .order('nome')

  // Recupera calciatori assegnati con partecipanti
  const { data: assignedPlayers } = await supabase
    .from('players')
    .select(`
      *,
      participants!assigned_to (
        display_name
      )
    `)
    .eq('room_id', roomData.id)
    .eq('is_assigned', true)
    .order('created_at', { ascending: false })

  return (
    <div className="min-h-screen bg-gray-50 bg-white">
      <div className="container mx-auto px-4 py-8">
        <AuctionAdmin 
          room={roomData}
          participants={participants || []}
          players={players || []}
          assignedPlayers={assignedPlayers || []}
        />
      </div>
    </div>
  )
}