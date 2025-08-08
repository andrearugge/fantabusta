'use client'

import Link from 'next/link'
import { Home } from 'lucide-react'

export default function Navbar() {
  return (
    <nav className="bg-white shadow-sm">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo/Nome */}
          <Link 
            href="/" 
            className="flex items-center gap-2 text-xl font-bold text-black hover:text-gray-700 transition-colors"
          >
            <Home className="h-6 w-6" />
            <span>Fantamaster</span>
          </Link>
          
          {/* Credits */}
          <div className="text-sm text-gray-600">
            Made by <span className="font-semibold text-black">Andrea</span>
          </div>
        </div>
      </div>
    </nav>
  )
}