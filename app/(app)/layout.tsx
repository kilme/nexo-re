'use client'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/lib/auth-context'

const NAV = [
  { href: '/properties', label: 'Inmuebles',    icon: '🏢' },
  { href: '/listings',   label: 'Publicaciones', icon: '📢' },
  { href: '/map',        label: 'Mapa',          icon: '🗺️' },
]

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { dynamicsUser } = useAuth()
  const pathname         = usePathname()

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

        {dynamicsUser && (
          <div className="ml-auto">
            <span className="text-white/70 text-xs">{dynamicsUser.name}</span>
          </div>
        )}
      </header>

      <main className="flex-1 overflow-hidden">
        {children}
      </main>
    </div>
  )
}
