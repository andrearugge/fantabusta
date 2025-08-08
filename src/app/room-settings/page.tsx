'use client'

import { useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Copy, Check, Settings, Users, Link as LinkIcon, Edit2, Save, X, Home, ChevronRight } from 'lucide-react'
import Link from 'next/link'

interface Participant {
  id: string
  display_name: string
  join_token: string
  join_url: string
  turn_order: number
}

interface Room {
  id: string
  code: string
  status: 'setup' | 'active' | 'completed'
  budget_default: number
  created_at: string
  participants: Participant[]
}

export default function RoomSettingsPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const roomCode = searchParams.get('code')
  
  const [room, setRoom] = useState<Room | null>(null)
  const [loading, setLoading] = useState(true)
  const [editingName, setEditingName] = useState(false)
  const [newName, setNewName] = useState('')
  const [copiedLinks, setCopiedLinks] = useState<Set<string>>(new Set())
  const [updating, setUpdating] = useState(false)

  useEffect(() => {
    if (roomCode) {
      fetchRoom()
    } else {
      setLoading(false)
    }
  }, [roomCode])

  const fetchRoom = async () => {
    if (!roomCode) return
    
    try {
      const response = await fetch(`/api/rooms/${roomCode}`)
      if (response.ok) {
        const { room } = await response.json()
        setRoom(room)
        setNewName(room.code)
      } else {
        console.error('Errore caricamento room')
      }
    } catch (error) {
      console.error('Errore:', error)
    } finally {
      setLoading(false)
    }
  }

  const updateRoomName = async () => {
    if (!roomCode || !newName.trim()) return
    
    setUpdating(true)
    try {
      const response = await fetch(`/api/rooms/${roomCode}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName })
      })
      
      if (response.ok) {
        setRoom(prev => prev ? { ...prev, code: newName } : null)
        setEditingName(false)
        // Aggiorna URL se necessario
        router.push(`/room-settings?code=${encodeURIComponent(newName)}`)
      } else {
        alert('Errore aggiornamento nome')
      }
    } catch (error) {
      console.error('Errore:', error)
      alert('Errore aggiornamento nome')
    } finally {
      setUpdating(false)
    }
  }

  const copyToClipboard = async (text: string, participantId: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedLinks(prev => new Set([...prev, participantId]))
      setTimeout(() => {
        setCopiedLinks(prev => {
          const newSet = new Set(prev)
          newSet.delete(participantId)
          return newSet
        })
      }, 2000)
    } catch (error) {
      console.error('Errore copia:', error)
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

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Caricamento...</p>
        </div>
      </div>
    )
  }

  if (!roomCode) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Codice asta mancante</h1>
          <p className="text-gray-600 mb-4">Specifica il codice dell'asta nei parametri URL</p>
          <Link href="/">
            <Button>Torna alla Homepage</Button>
          </Link>
        </div>
      </div>
    )
  }

  if (!room) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Asta non trovata</h1>
          <p className="text-gray-600 mb-4">L'asta con codice "{roomCode}" non esiste</p>
          <Link href="/">
            <Button>Torna alla Homepage</Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        {/* Breadcrumbs */}
        <nav className="flex items-center space-x-2 text-sm text-gray-600 mb-6">
          <Link href="/" className="flex items-center hover:text-gray-900 transition-colors">
            <Home className="h-4 w-4 mr-1" />
            Homepage
          </Link>
          <ChevronRight className="h-4 w-4" />
          <Link href={`/auction/${room.code}`} className="hover:text-gray-900 transition-colors">
            Asta {room.code}
          </Link>
          <ChevronRight className="h-4 w-4" />
          <span className="text-gray-900 font-medium">Impostazioni</span>
        </nav>

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-black flex items-center gap-2">
              <Settings className="h-8 w-8" />
              Impostazioni Asta
            </h1>
            <p className="text-gray-600 mt-2">Gestisci le impostazioni e i link dei partecipanti</p>
          </div>
          <Link href={`/auction/${room.code}`}>
            <Button variant="outline">Vai all'Asta</Button>
          </Link>
        </div>

        {/* Informazioni Asta */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Informazioni Asta</span>
              {getStatusBadge(room.status)}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="room-name">Nome Asta</Label>
                {editingName ? (
                  <div className="flex gap-2 mt-1">
                    <Input
                      id="room-name"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      placeholder="Nome asta"
                    />
                    <Button
                      size="sm"
                      onClick={updateRoomName}
                      disabled={updating || !newName.trim()}
                    >
                      {updating ? '...' : <Save className="h-4 w-4" />}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setEditingName(false)
                        setNewName(room.code)
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 mt-1">
                    <Input value={room.code} readOnly />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setEditingName(true)}
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
              <div>
                <Label>Budget Iniziale</Label>
                <Input value={`${room.budget_default}M€`} readOnly className="mt-1" />
              </div>
            </div>
            <div>
              <Label>Data Creazione</Label>
              <Input 
                value={new Date(room.created_at).toLocaleString('it-IT')} 
                readOnly 
                className="mt-1" 
              />
            </div>
          </CardContent>
        </Card>

        {/* Link Partecipanti */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Link Partecipanti ({room.participants.length})
            </CardTitle>
            <CardDescription>
              Condividi questi link con i partecipanti per permettere loro di accedere all'asta
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {room.participants
                .sort((a, b) => a.turn_order - b.turn_order)
                .map((participant) => (
                <div key={participant.id} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">#{participant.turn_order + 1}</Badge>
                      <span className="font-semibold">{participant.display_name}</span>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <div>
                      <Label className="text-xs text-gray-500">Link Partecipazione</Label>
                      <div className="flex gap-2">
                        <Input 
                          value={participant.join_url || `${window.location.origin}/p/${participant.join_token}`}
                          readOnly 
                          className="font-mono text-sm"
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => copyToClipboard(
                            participant.join_url || `${window.location.origin}/p/${participant.join_token}`,
                            participant.id
                          )}
                        >
                          {copiedLinks.has(participant.id) ? (
                            <Check className="h-4 w-4 text-green-600" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                    
                    <div>
                      <Label className="text-xs text-gray-500">Token</Label>
                      <div className="flex gap-2">
                        <Input 
                          value={participant.join_token}
                          readOnly 
                          className="font-mono text-sm"
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => copyToClipboard(participant.join_token, `token-${participant.id}`)}
                        >
                          {copiedLinks.has(`token-${participant.id}`) ? (
                            <Check className="h-4 w-4 text-green-600" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}