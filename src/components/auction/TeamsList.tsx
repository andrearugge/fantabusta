'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Room, Participant, Player } from '@/types'
import TeamsView from '@/components/teams/TeamsView'

interface TeamsListProps {
  room: Room
  participants: Participant[]
}

export default function TeamsList({ room, participants }: TeamsListProps) {
  const [assignedPlayers, setAssignedPlayers] = useState<(Player & {
    participants?: {
      id: string
      display_name: string
    }
    purchase_price?: number
  })[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    const fetchAssignedPlayers = async () => {
      try {
        const { data } = await supabase
          .from('players')
          .select(`
            *,
            participants!assigned_to (
              id,
              display_name
            )
          `)
          .eq('room_id', room.id)
          .eq('is_assigned', true)
          .not('assigned_to', 'is', null)

        setAssignedPlayers(data || [])
      } catch (error) {
        console.error('Errore nel recuperare i giocatori assegnati:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchAssignedPlayers()

    // Sottoscrizione per aggiornamenti real-time
    const channel = supabase
      .channel(`room-${room.id}-teams`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'players',
        filter: `room_id=eq.${room.id}`
      }, () => {
        fetchAssignedPlayers()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [room.id, supabase])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-gray-500">Caricamento formazioni...</div>
      </div>
    )
  }

  return (
    <TeamsView 
      room={room}
      participants={participants}
      assignedPlayers={assignedPlayers}
    />
  )
}