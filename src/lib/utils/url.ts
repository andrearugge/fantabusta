export function getBaseUrl(): string {
  // In ambiente server-side (durante il build)
  if (typeof window === 'undefined') {
    // Vercel fornisce automaticamente queste variabili
    if (process.env.VERCEL_URL) {
      return `https://${process.env.VERCEL_URL}`
    }
    // Fallback per altri provider o sviluppo locale
    return process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
  }
  
  // In ambiente client-side
  // In produzione, usa sempre l'origin corrente
  if (process.env.NODE_ENV === 'production') {
    return window.location.origin
  }
  
  // In sviluppo, usa localhost
  return 'http://localhost:3000'
}