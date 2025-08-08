'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

interface RealtimeEvent {
  timestamp: string
  event: string
  payload: any
}

export function RealtimeDebugger() {
  const [events, setEvents] = useState<RealtimeEvent[]>([])
  const [isConnected, setIsConnected] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    const channel = supabase
      .channel('debug_channel')
      .on('broadcast', { event: '*' }, (payload) => {
        setEvents(prev => [{
          timestamp: new Date().toLocaleTimeString(),
          event: payload.event,
          payload: payload.payload
        }, ...prev].slice(0, 20)) // Keep last 20 events
      })
      .subscribe((status) => {
        setIsConnected(status === 'SUBSCRIBED')
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  const clearEvents = () => setEvents([])

  const sendTestEvent = () => {
    supabase
      .channel('debug_channel')
      .send({
        type: 'broadcast',
        event: 'test_event',
        payload: { message: 'Test message', timestamp: Date.now() }
      })
  }

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle>Realtime Debugger</CardTitle>
          <div className="flex gap-2 items-center">
            <Badge variant={isConnected ? 'default' : 'destructive'}>
              {isConnected ? 'Connected' : 'Disconnected'}
            </Badge>
            <Button size="sm" onClick={sendTestEvent}>
              Send Test
            </Button>
            <Button size="sm" variant="outline" onClick={clearEvents}>
              Clear
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {events.length === 0 ? (
            <p className="text-muted-foreground text-sm">No events received yet...</p>
          ) : (
            events.map((event, index) => (
              <div key={index} className="p-2 border rounded text-sm">
                <div className="flex justify-between items-center mb-1">
                  <Badge variant="outline">{event.event}</Badge>
                  <span className="text-xs text-muted-foreground">{event.timestamp}</span>
                </div>
                <pre className="text-xs bg-muted p-2 rounded overflow-x-auto">
                  {JSON.stringify(event.payload, null, 2)}
                </pre>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  )
}