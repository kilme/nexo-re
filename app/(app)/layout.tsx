'use client'
import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/lib/auth-context'

const NAV = [
  { href: '/properties', label: 'Inmuebles',    icon: '🏢' },
  { href: '/listings',   label: 'Publicaciones', icon: '📢' },
  { href: '/map',        label: 'Mapa',          icon: '🗺️' },
]

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, logout, isEmbed, dynamicsUser } = useAuth()
  const router   = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (!loading && !user) router.replace('/login')
  }, [user, loading, router])

  if (loading || !user) return (
    <div className="min-h-screen bg-col-gray flex items-center justify-center">
      <div className="w-5 h-5 border-2 border-dyn border-t-transparent rounded-full animate-spin" />
    </div>
  )

  const displayName = dynamicsUser?.name ?? user.email

  return (
    <div className="h-screen flex flex-col bg-col-gray">
      {/* Top bar — Dynamics style */}
      <header className="h-12 bg-dyn flex items-center px-4 gap-4 flex-shrink-0 shadow-sm">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-white/20 rounded flex items-center justify-center">
            <span className="text-white font-bold text-xs">N</span>
          </div>
          <span className="text-white font-semibold text-sm tracking-wide">Nexo<span className="opacity-70">.RE</span></span>
        </div>

        {/* Nav */}
        <nav className="flex items-center gap-1 ml-4">
          {NAV.map(n => (
            <Link key={n.href} href={n.href}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-sm transition-colors ${
                pathname.startsWith(n.href)
                  ? 'bg-white/20 text-white'
                  : 'text-white/70 hover:bg-white/10 hover:text-white'
              }`}>
              <span className="text-xs">{n.icon}</span>
              {n.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-3">
          <span className="text-white/70 text-xs">{displayName}</span>
          {!isEmbed && (
            <button onClick={() => { logout(); router.replace('/login') }}
              className="text-white/70 hover:text-white text-xs transition-colors">
              Salir
            </button>
          )}
        </div>
      </header>

      <main className="flex-1 overflow-hidden">
        {children}
      </main>
    </div>
  )
}
