'use client'

import { Suspense, useState, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Copy, Check, Users, Settings, Home, ChevronRight, Upload, FileText, AlertTriangle, Play, Pause, Edit2 } from 'lucide-react'
import Link from 'next/link'
import { getBaseUrl } from '@/lib/utils/url'
import { CSVPlayer } from '@/types'

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
  status: 'setup' | 'active' | 'completed' | 'paused'
  budget_default: number
  created_at: string
  participants: Participant[]
}

// Componente che usa useSearchParams
function RoomSettingsContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const roomCode = searchParams.get('code')

  const [room, setRoom] = useState<Room | null>(null)
  const [loading, setLoading] = useState(true)
  const [copiedLinks, setCopiedLinks] = useState<Set<string>>(new Set())
  const [baseUrl, setBaseUrl] = useState('')

  // Stati per re-importazione CSV
  const [csvData, setCsvData] = useState<CSVPlayer[]>([])
  const [csvFileName, setCsvFileName] = useState('')
  const [isReimporting, setIsReimporting] = useState(false)

  // Stati per controllo asta
  const [isPausing, setIsPausing] = useState(false)

  // Stati per modifica nomi partecipanti
  const [editingParticipant, setEditingParticipant] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [isUpdatingName, setIsUpdatingName] = useState(false)

  useEffect(() => {
    // Imposta l'URL di base quando il componente si monta
    setBaseUrl(getBaseUrl())
  }, [])

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
      } else {
        console.error('Errore caricamento room')
      }
    } catch (error) {
      console.error('Errore:', error)
    } finally {
      setLoading(false)
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

  // Funzione per aggiornare il nome del partecipante
  const updateParticipantName = async (participantId: string, newName: string) => {
    if (!newName.trim()) {
      alert('Il nome non può essere vuoto')
      return
    }

    setIsUpdatingName(true)
    try {
      const response = await fetch('/api/participants/update', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          participantId,
          displayName: newName.trim()
        })
      })

      if (!response.ok) {
        throw new Error('Errore aggiornamento nome')
      }

      const result = await response.json()

      // Aggiorna lo stato locale
      setRoom(prev => ({
        ...prev!,
        participants: prev!.participants.map(p =>
          p.id === participantId
            ? { ...p, display_name: result.participant.display_name }
            : p
        )
      }))

      setEditingParticipant(null)
      setEditingName('')

    } catch (error) {
      console.error('Errore:', error)
      alert('Errore durante l\'aggiornamento del nome')
    } finally {
      setIsUpdatingName(false)
    }
  }

  // Funzione per parsing CSV
  const parseCsv = (text: string): CSVPlayer[] => {
    const lines = text.trim().split('\n')
    const players: CSVPlayer[] = []
    const validRoles = ['P', 'D', 'C', 'A']
    const errors: string[] = []

    for (let i = 1; i < lines.length; i++) { // Skip header
      const line = lines[i].trim()
      if (!line) continue // Skip empty lines

      // Formato corretto: id,name,role,team
      const [player_id, nome, ruolo, squadra] = line.split(',')

      if (!player_id || !nome || !ruolo || !squadra) {
        errors.push(`Riga ${i + 1}: Dati mancanti (id: "${player_id}", name: "${nome}", role: "${ruolo}", team: "${squadra}")`)
        continue
      }

      const cleanRuolo = ruolo.trim().toUpperCase()
      const playerId = parseInt(player_id.trim())

      // Validazione player_id
      if (isNaN(playerId)) {
        errors.push(`Riga ${i + 1}: ID non valido "${player_id}" per giocatore "${nome}". Deve essere un numero`)
        continue
      }

      // Validazione ruolo
      if (!validRoles.includes(cleanRuolo)) {
        errors.push(`Riga ${i + 1}: Ruolo non valido "${ruolo}" per giocatore "${nome}". Ruoli validi: P, D, C, A`)
        continue
      }

      players.push({
        player_id: playerId,
        nome: nome.trim(),
        ruolo: cleanRuolo as 'P' | 'D' | 'C' | 'A',
        squadra: squadra.trim()
      })
    }

    // Mostra errori se presenti
    if (errors.length > 0) {
      console.error('Errori nel CSV:', errors)
      alert(`Errori trovati nel CSV:\n${errors.join('\n')}`)
    }

    return players
  }

  // Gestione upload file CSV
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (!file.name.endsWith('.csv')) {
      alert('Per favore seleziona un file CSV')
      return
    }

    setCsvFileName(file.name)

    try {
      const text = await file.text()
      const parsed = parseCsv(text)
      setCsvData(parsed)
    } catch (error) {
      console.error('Errore lettura file CSV:', error)
      alert('Errore nella lettura del file CSV')
      setCsvData([])
      setCsvFileName('')
    }
  }

  // Funzione per re-importare i giocatori
  const handleReimportPlayers = async () => {
    if (!room || csvData.length === 0) return

    const confirmed = confirm(
      `Sei sicuro di voler re-importare ${csvData.length} giocatori?\n\n` +
      'ATTENZIONE: Questa operazione cancellerà TUTTI i giocatori esistenti e le relative offerte.'
    )

    if (!confirmed) return

    setIsReimporting(true)
    try {
      const response = await fetch('/api/rooms/reimport-players', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId: room.id,
          players: csvData
        })
      })

      const result = await response.json()

      if (response.ok) {
        alert(`✅ ${result.message}`)
        setCsvData([])
        setCsvFileName('')
        // Reset del file input
        const fileInput = document.getElementById('csv-file') as HTMLInputElement
        if (fileInput) fileInput.value = ''
      } else {
        alert(`❌ Errore: ${result.error}`)
      }
    } catch (error) {
      console.error('Errore re-importazione:', error)
      alert('❌ Errore durante la re-importazione')
    } finally {
      setIsReimporting(false)
    }
  }

  // Funzione per mettere in pausa/riprendere l'asta
  const handlePauseToggle = async () => {
    if (!room) return

    const action = room.status === 'paused' ? 'riprendere' : 'mettere in pausa'
    const confirmed = confirm(`Sei sicuro di voler ${action} l'asta?`)

    if (!confirmed) return

    setIsPausing(true)
    try {
      const response = await fetch('/api/rooms/pause', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId: room.id,
          action: room.status === 'paused' ? 'resume' : 'pause'
        })
      })

      const result = await response.json()

      if (response.ok) {
        setRoom(prev => prev ? { ...prev, status: result.newStatus } : null)
        alert(`✅ Asta ${result.newStatus === 'paused' ? 'messa in pausa' : 'ripresa'} con successo`)
      } else {
        alert(`❌ Errore: ${result.error}`)
      }
    } catch (error) {
      console.error('Errore controllo asta:', error)
      alert('❌ Errore durante il controllo dell\'asta')
    } finally {
      setIsPausing(false)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'setup':
        return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">In Configurazione</Badge>
      case 'active':
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Attiva</Badge>
      case 'paused':
        return <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">In Pausa</Badge>
      case 'completed':
        return <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200">Completata</Badge>
      default:
        return <Badge variant="outline">Sconosciuto</Badge>
    }
  }

  if (loading) {
    return (
      <div className="container-fluid mx-auto px-4 py-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Caricamento...</p>
        </div>
      </div>
    )
  }

  if (!roomCode) {
    return (
      <div className="container-fluid mx-auto px-4 py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Codice asta mancante</h1>
          <p className="text-gray-600 mb-4">Specifica il codice dell&apos;asta nei parametri URL</p>
          <Link href="/">
            <Button>Torna alla Homepage</Button>
          </Link>
        </div>
      </div>
    )
  }

  if (!room) {
    return (
      <div className="container-fluid mx-auto px-4 py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Asta non trovata</h1>
          <p className="text-gray-600 mb-4">L&apos;asta con codice &quot;{roomCode}&quot; non esiste</p>
          <Link href="/">
            <Button>Torna alla Homepage</Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="container-fluid mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        {/* Breadcrumbs */}
        <nav className="flex items-center space-x-2 text-sm text-gray-600 mb-6">
          <Link href="/" className="flex items-center hover:text-gray-900 transition-colors">
            <Home className="h-4 w-4 mr-1" />
            Homepage
          </Link>
          <ChevronRight className="h-4 w-4" />
          <Link href={`/auction/${room.code}`} className="hover:text-gray-900 transition-colors">
            Asta
          </Link>
          <ChevronRight className="h-4 w-4" />
          <span className="text-gray-900 font-medium">Impostazioni</span>
        </nav>

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-lg lg:text-3xl font-bold text-black flex items-center gap-2">
              Impostazioni Asta
            </h1>
            <p className="text-gray-600 mt-2">Gestisci le impostazioni e i link dei partecipanti</p>
          </div>
          <Link href={`/auction/${room.code}`}>
            <Button variant="outline"><Settings className="h-4 w-4"/> Admin asta</Button>
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
                <Label>Nome Asta</Label>
                <Input value={room.code} readOnly className="mt-1" />
              </div>
              <div>
                <Label>Budget Iniziale</Label>
                <Input value={`${room.budget_default}M`} readOnly className="mt-1" />
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

        {/* Controllo Asta */}
        {(room.status === 'active' || room.status === 'paused') && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {room.status === 'paused' ? <Play className="h-5 w-5" /> : <Pause className="h-5 w-5" />}
                Controllo Asta
              </CardTitle>
              <CardDescription>
                {room.status === 'paused'
                  ? 'L\'asta è attualmente in pausa. Puoi riprenderla quando sei pronto.'
                  : 'Puoi mettere in pausa l\'asta per interromperla temporaneamente.'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                onClick={handlePauseToggle}
                disabled={isPausing}
                variant={room.status === 'paused' ? 'default' : 'outline'}
                className="w-full"
              >
                {isPausing ? (
                  'Operazione in corso...'
                ) : (
                  <>
                    {room.status === 'paused' ? (
                      <><Play className="h-4 w-4 mr-2" />Riprendi Asta</>
                    ) : (
                      <><Pause className="h-4 w-4 mr-2" />Metti in Pausa</>
                    )}
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Re-importazione Giocatori */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Re-importazione Giocatori
            </CardTitle>
            <CardDescription>
              Carica un nuovo file CSV per sostituire tutti i giocatori esistenti
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {room?.status === 'active' && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-2">
                <div className="flex items-center gap-2 text-yellow-800">
                  <AlertTriangle className="h-5 w-5" />
                  <span className="font-medium text-sm">Asta in corso</span>
                </div>
                <p className="text-yellow-700 mt-1 text-sm">
                  Non è possibile re-importare giocatori durante un'asta attiva
                </p>
              </div>
            )}

            <div>
              <Label htmlFor="csv-file">File CSV Giocatori</Label>
              <Input
                id="csv-file"
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                disabled={room?.status === 'active'}
                className="mt-1"
              />
              <p className="text-sm text-gray-500 mt-1">
                Formato richiesto: id,name,role,team (P/D/C/A)
              </p>
            </div>

            {csvFileName && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center gap-2 text-blue-800">
                  <FileText className="h-5 w-5" />
                  <span className="font-medium">{csvFileName}</span>
                </div>
                <p className="text-blue-700 mt-1">
                  {csvData.length} giocatori trovati
                </p>

                {csvData.length > 0 && (
                  <div className="mt-3">
                    <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-3">
                      <div className="flex items-center gap-2 text-red-800">
                        <AlertTriangle className="h-4 w-4" />
                        <span className="font-medium">Attenzione</span>
                      </div>
                      <p className="text-red-700 text-sm mt-1">
                        Questa operazione cancellerà TUTTI i giocatori esistenti e le relative offerte
                      </p>
                    </div>

                    <Button
                      onClick={handleReimportPlayers}
                      disabled={isReimporting || room?.status === 'active'}
                      className="w-full"
                    >
                      {isReimporting ? 'Re-importazione in corso...' : `Re-importa ${csvData.length} giocatori`}
                    </Button>
                  </div>
                )}
              </div>
            )}
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
              Condividi questi link con i partecipanti per permettere loro di accedere all&apos;asta
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {room.participants
                .sort((a, b) => a.turn_order - b.turn_order)
                .map((participant, index) => (
                  <div key={participant.id} className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <Badge variant="outline">{index + 1}</Badge>
                      {editingParticipant === participant.id ? (
                        <div className="flex items-center gap-2">
                          <Input
                            value={editingName}
                            onChange={(e) => setEditingName(e.target.value)}
                            className="w-40"
                            placeholder="Nome partecipante"
                            disabled={isUpdatingName}
                          />
                          <Button
                            size="sm"
                            onClick={() => updateParticipantName(participant.id, editingName)}
                            disabled={isUpdatingName || !editingName.trim()}
                          >
                            {isUpdatingName ? 'Salvataggio...' : 'Salva'}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setEditingParticipant(null)
                              setEditingName('')
                            }}
                            disabled={isUpdatingName}
                          >
                            Annulla
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{participant.display_name}</span>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setEditingParticipant(participant.id)
                              setEditingName(participant.display_name)
                            }}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                    <div className="flex flex-1 items-center gap-2">
                      <div className="flex-1 text-right">
                        <p className="text-sm text-gray-600 w-full">{`${getBaseUrl()}/p/${participant.join_url}`}</p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => copyToClipboard(`${getBaseUrl()}/p/${participant.join_url}`, participant.id)}
                      >
                        {copiedLinks.has(participant.id) ? (
                          <Check className="h-4 w-4" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                ))
              }
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

// Componente di loading
function RoomSettingsLoading() {
  return (
    <div className="container-fluid mx-auto px-4 py-8">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-2 text-gray-600">Caricamento...</p>
      </div>
    </div>
  )
}

// Componente principale con Suspense
export default function RoomSettingsPage() {
  return (
    <Suspense fallback={<RoomSettingsLoading />}>
      <RoomSettingsContent />
    </Suspense>
  )
}