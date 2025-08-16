import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Trophy, Users, Timer, Zap } from 'lucide-react'
import ActiveRooms from '@/components/ui/ActiveRooms'

export default function HomePage() {
  return (
    <div className="container mx-auto px-4 py-8">

      {/* Aste Attive */}
      <div className="mb-12">
        <h2 className="text-2xl font-bold text-black mb-6">Aste Attive</h2>
        <ActiveRooms />
      </div>
    </div>
  )
}