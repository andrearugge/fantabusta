'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Users, Calendar, DollarSign, Play, Settings, Trophy } from 'lucide-react'

interface Room {
  id: string
  code: string
  status: 'setup' | 'active' | 'completed'
  budget_default: number
  created_at: string
  participants: { count: number }[]
}

export default function ActiveRooms() {
  const [rooms, setRooms] = useState<Room[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchRooms()
  }, [])

  const fetchRooms = async () => {
    try {
      const response = await fetch('/api/rooms/list')
      if (response.ok) {
        const { rooms } = await response.json()
        setRooms(rooms)
      }
    } catch (error) {
      console.error('Errore caricamento aste:', error)
    } finally {
      setLoading(false)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'setup':
        return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">In Configurazione</Badge>
      case 'active':
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Attiva</Badge>
      default:
        return <Badge variant="outline">Completata</Badge>
    }
  }

  const getStatusIcon = (status: string) => {
    return status === 'active' ? <Play className="h-4 w-4" /> : <Settings className="h-4 w-4" />
  }

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-2 text-gray-600">Caricamento aste...</p>
      </div>
    )
  }

  if (rooms.length === 0) {
    return (
      <div className="text-center py-8">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Nessuna asta attiva</h3>
        <p className="text-gray-600 mb-4">Crea la prima asta per iniziare!</p>
        <Link href="/setup">
          <Button>Crea Nuova Asta</Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
      {rooms.map((room) => {
        const participantCount = room.participants[0]?.count || 0
        const createdDate = new Date(room.created_at).toLocaleDateString('it-IT')
        
        return (
          <Card key={room.id} className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  {getStatusIcon(room.status)}
                  Asta {room.code}
                </CardTitle>
                {getStatusBadge(room.status)}
              </div>
              <CardDescription>
                Creata il {createdDate}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-1">
                  <Users className="h-4 w-4 text-gray-500" />
                  <span>{participantCount} partecipanti</span>
                </div>
                <div className="flex items-center gap-1">
                  <DollarSign className="h-4 w-4 text-gray-500" />
                  <span>{room.budget_default}M€</span>
                </div>
              </div>
              
              <div className="flex gap-2">
                <Link href={`/auction/${room.code}`} className="flex-1">
                  <Button className="cursor-pointer w-full" size="sm">
                    {room.status === 'active' ? 'Partecipa' : 'Gestisci'}
                  </Button>
                </Link>
                <Link href={`/teams/${room.code}`}>
                  <Button variant="outline" size="sm" className="cursor-pointer px-3">
                    Formazioni
                  </Button>
                </Link>
                <Link href={`/room-settings?code=${room.code}`}>
                  <Button variant="outline" size="sm" className="cursor-pointer px-3">
                    <Settings className="h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}