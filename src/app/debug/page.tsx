"use client"

import { RealtimeDebugger } from '@/components/debug/RealtimeDebugger'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export default function DebugPage() {
  return (
    <div className="container-fluid mx-auto p-6 space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold">Fantabusta Debug</h1>
        <p className="text-muted-foreground mt-2">
          Strumenti per testing e debugging dell&apos;applicazione
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>API Testing</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Testa le API routes principali
            </p>
            <div className="space-y-2">
              <Button className="cursor-pointer w-full" onClick={() => {
                fetch('/api/rooms/create', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    participants: [{ name: 'Test User', budget: 500 }],
                    players: [{ name: 'Test Player', role: 'A', price: 25 }]
                  })
                }).then(r => r.json()).then(console.log)
              }}>
                Test Create Room
              </Button>
              <Button className="cursor-pointer w-full" variant="outline">
                Test Start Auction
              </Button>
              <Button className="cursor-pointer w-full" variant="outline">
                Test Place Bid
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Database Status</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Verifica connessione e stato del database
            </p>
            <div className="mt-4 space-y-2">
              <div className="flex justify-between">
                <span>Supabase URL:</span>
                <span className="text-sm font-mono">
                  {process.env.NEXT_PUBLIC_SUPABASE_URL ? '✅ Set' : '❌ Missing'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Supabase Key:</span>
                <span className="text-sm font-mono">
                  {process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? '✅ Set' : '❌ Missing'}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <RealtimeDebugger />
    </div>
  )
}