'use client'

import { useRealtimeBids } from '@/hooks/useRealtimeBids'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface LiveBidsProps {
  playerId: string | null
  playerName?: string
}

export function LiveBids({ playerId, playerName }: LiveBidsProps) {
  const bids = useRealtimeBids(playerId)

  if (!playerId || bids.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Offerte Live</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {playerId ? 'Nessuna offerta ancora' : 'Seleziona un calciatore'}
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">
          Offerte Live {playerName && `- ${playerName}`}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {bids.map((bid, index) => (
          <div key={`${bid.participant_name}-${bid.timestamp}`} 
               className="flex justify-between items-center p-2 rounded border">
            <span className="font-medium">{bid.participant_name}</span>
            <div className="flex items-center gap-2">
              <Badge variant={index === 0 ? 'default' : 'secondary'}>
                €{bid.amount.toLocaleString()}
              </Badge>
              {index === 0 && (
                <Badge variant="outline" className="text-green-600">
                  Migliore
                </Badge>
              )}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}