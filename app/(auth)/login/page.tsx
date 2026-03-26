'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'

export default function LoginPage() {
  const { login } = useAuth()
  const router    = useRouter()
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(email, password)
      router.push('/properties')
    } catch {
      setError('Email o contraseña incorrectos.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-dyn-light flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-2">
            <div className="w-8 h-8 bg-dyn rounded flex items-center justify-center">
              <span className="text-white font-bold text-sm">N</span>
            </div>
            <span className="text-2xl font-semibold text-col-text">Nexo<span className="text-dyn">.RE</span></span>
          </div>
          <p className="text-sm text-col-muted">Real Estate Intelligence Portal</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-sm shadow-card p-8">
          <h1 className="text-lg font-semibold text-col-text mb-6">Iniciar sesión</h1>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-col-text mb-1">Email</label>
              <input
                type="email" value={email} onChange={e => setEmail(e.target.value)} required
                className="w-full border border-col-border rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-dyn focus:ring-1 focus:ring-dyn transition-colors"
                placeholder="usuario@empresa.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-col-text mb-1">Contraseña</label>
              <input
                type="password" value={password} onChange={e => setPassword(e.target.value)} required
                className="w-full border border-col-border rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-dyn focus:ring-1 focus:ring-dyn transition-colors"
                placeholder="••••••••"
              />
            </div>
            {error && <p className="text-red-600 text-xs">{error}</p>}
            <button
              type="submit" disabled={loading}
              className="w-full bg-dyn hover:bg-dyn-dark text-white font-medium py-2 px-4 rounded-sm text-sm transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? 'Iniciando sesión...' : 'Iniciar sesión'}
            </button>
          </form>
        </div>
        <p className="text-center text-xs text-col-muted mt-6">© {new Date().getFullYear()} Nexo.RE</p>
      </div>
    </div>
  )
}
