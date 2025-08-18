'use client'

import Link from 'next/link'

export default function Navbar() {
  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo/Nome */}
          <Link 
            href="/" 
            className="flex items-center gap-2 text-xl font-bold text-black hover:text-gray-700 transition-colors"
          >
            <span>Fantabusta</span>
          </Link>
          
          {/* Credits */}
          <div className="text-sm text-gray-600">
            Seguimi su <Link className="font-medium text-black" href={'https://tinyurl.com/7ywkcjfw'} target="_blank">Instagram</Link>
          </div>
        </div>
      </div>
    </nav>
  )
}