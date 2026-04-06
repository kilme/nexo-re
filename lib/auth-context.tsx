'use client'
import { createContext, useContext, useEffect, useState } from 'react'
import { signInAnonymously } from 'firebase/auth'
import { auth } from './firebase'

export interface DynamicsUser {
  name:  string
  guid:  string
  email: string
}

interface AuthContextType {
  dynamicsUser: DynamicsUser | null
  isEmbed:      boolean
}

const AuthContext = createContext<AuthContextType>({ dynamicsUser: null, isEmbed: false })

function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null
  const match = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'))
  return match ? decodeURIComponent(match[1]) : null
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [dynamicsUser, setDynamicsUser] = useState<DynamicsUser | null>(null)
  const [isEmbed,      setIsEmbed]      = useState(false)

  useEffect(() => {
    // Leer contexto Dynamics del cookie
    const cookie = getCookie('nexo-dynamics-user')
    if (cookie) {
      try {
        setDynamicsUser(JSON.parse(cookie) as DynamicsUser)
        setIsEmbed(true)
      } catch { /* ignorar */ }
    }

    // Sesión anónima para que Firestore funcione sin login
    signInAnonymously(auth).catch(console.error)
  }, [])

  return (
    <AuthContext.Provider value={{ dynamicsUser, isEmbed }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
