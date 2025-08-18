'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { X, Upload, Users, DollarSign, FileText } from 'lucide-react'
import { CSVPlayer } from '@/types'

export default function SetupPage() {
  const router = useRouter()
  const [participants, setParticipants] = useState<string[]>(['', '', '', '', '', ''])
  const [budget, setBudget] = useState(500)
  const [csvData, setCsvData] = useState<CSVPlayer[]>([])
  const [csvFileName, setCsvFileName] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const addParticipant = () => {
    if (participants.length < 10) {
      setParticipants([...participants, ''])
    }
  }

  const removeParticipant = (index: number) => {
    if (participants.length > 6) {
      setParticipants(participants.filter((_, i) => i !== index))
    }
  }

  const updateParticipant = (index: number, value: string) => {
    const updated = [...participants]
    updated[index] = value
    setParticipants(updated)
  }

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

  const clearCsvFile = () => {
    setCsvData([])
    setCsvFileName('')
    // Reset file input
    const fileInput = document.getElementById('csv-file') as HTMLInputElement
    if (fileInput) fileInput.value = ''
  }

  const handleSubmit = async () => {
    setIsLoading(true)
    
    const validParticipants = participants.filter(p => p.trim() !== '')
    
    if (validParticipants.length < 6) {
      alert('Servono almeno 6 partecipanti')
      setIsLoading(false)
      return
    }

    if (csvData.length === 0) {
      alert('Carica la lista calciatori')
      setIsLoading(false)
      return
    }

    try {
      const response = await fetch('/api/rooms/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          participants: validParticipants,
          budget,
          players: csvData
        })
      })

      if (response.ok) {
        const { roomCode } = await response.json()
        router.push(`/auction/${roomCode}`)
      } else {
        throw new Error('Errore creazione asta')
      }
    } catch (error) {
      console.error('Errore:', error)
      alert('Errore nella creazione dell\'asta')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 bg-white">
      <div className="container-fluid mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold text-black mb-8">Setup Nuova Asta</h1>
          
          <div className="grid gap-6 md:grid-cols-2">
            {/* Partecipanti */}
            <Card className="border-2 border-black">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Partecipanti ({participants.filter(p => p.trim()).length}/10)
                </CardTitle>
                <CardDescription>
                  Inserisci i nomi dei partecipanti (min 6, max 10)
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {participants.map((participant, index) => (
                  <div key={index} className="flex gap-2">
                    <Input
                      placeholder={`Partecipante ${index + 1}`}
                      value={participant}
                      onChange={(e) => updateParticipant(index, e.target.value)}
                    />
                    {participants.length > 6 && (
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => removeParticipant(index)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
                
                {participants.length < 10 && (
                  <Button variant="outline" onClick={addParticipant} className="w-full">
                    Aggiungi Partecipante
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* Budget */}
            <Card className="border border-gray-200">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  Budget Iniziale
                </CardTitle>
                <CardDescription>
                  Budget per ogni partecipante (in milioni)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Label htmlFor="budget">Budget (M)</Label>
                  <Input
                    id="budget"
                    type="number"
                    value={budget}
                    onChange={(e) => setBudget(Number(e.target.value))}
                    min={100}
                    max={1000}
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* CSV Upload */}
          <Card className="border-2 border-black mt-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5" />
                Lista Calciatori CSV
              </CardTitle>
              <CardDescription>
                Carica un file CSV con formato: nome,ruolo,squadra (P=Portiere, D=Difensore, C=Centrocampista, A=Attaccante)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <Label htmlFor="csv-file" className="cursor-pointer">
                    <div className="flex items-center gap-2 px-4 py-2 border-2 border-dashed border-gray-300 rounded-lg hover:border-gray-400 transition-colors">
                      <FileText className="h-5 w-5" />
                      <span>Seleziona file CSV</span>
                    </div>
                  </Label>
                  <Input
                    id="csv-file"
                    type="file"
                    accept=".csv"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  {csvFileName && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={clearCsvFile}
                    >
                      <X className="h-4 w-4 mr-1" />
                      Rimuovi
                    </Button>
                  )}
                </div>
                
                {csvFileName && (
                  <div className="flex items-center gap-2 text-sm text-blue-600">
                    <FileText className="h-4 w-4" />
                    <span>File caricato: {csvFileName}</span>
                  </div>
                )}
                
                {csvData.length > 0 && (
                  <div className="text-sm text-green-600">
                    ✓ {csvData.length} calciatori caricati
                  </div>
                )}
                
                {csvData.length > 0 && (
                  <div className="text-xs text-gray-500">
                    <details>
                      <summary className="cursor-pointer hover:text-gray-700">Anteprima calciatori (primi 5)</summary>
                      <div className="mt-2 space-y-1">
                        {csvData.slice(0, 5).map((player, index) => (
                          <div key={index} className="flex gap-2">
                            <span className="font-medium">{player.nome}</span>
                            <span className="text-gray-400">({player.ruolo})</span>
                            <span className="text-gray-400">{player.squadra}</span>
                          </div>
                        ))}
                        {csvData.length > 5 && (
                          <div className="text-gray-400">... e altri {csvData.length - 5} calciatori</div>
                        )}
                      </div>
                    </details>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Submit */}
          <div className="mt-8 flex justify-end">
            <Button 
              onClick={handleSubmit} 
              disabled={isLoading}
              className="px-8"
            >
              {isLoading ? 'Creazione...' : 'Crea Asta'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}