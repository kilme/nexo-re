'use client'
import { createContext, useContext, useEffect, useState } from 'react'
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithCustomToken,
  signOut,
  User,
} from 'firebase/auth'
import { auth } from './firebase'

export interface DynamicsUser {
  name:  string
  guid:  string
  email: string
}

interface AuthContextType {
  user:         User | null
  loading:      boolean
  isEmbed:      boolean
  dynamicsUser: DynamicsUser | null
  login:        (email: string, password: string) => Promise<void>
  logout:       () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null, loading: true, isEmbed: false, dynamicsUser: null,
  login: async () => {}, logout: async () => {},
})

function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null
  const match = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'))
  return match ? decodeURIComponent(match[1]) : null
}

function deleteCookie(name: string) {
  document.cookie = `${name}=; Max-Age=0; path=/; SameSite=None; Secure`
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user,         setUser]         = useState<User | null>(null)
  const [loading,      setLoading]      = useState(true)
  const [isEmbed,      setIsEmbed]      = useState(false)
  const [dynamicsUser, setDynamicsUser] = useState<DynamicsUser | null>(null)

  useEffect(() => {
    // 1. Leer contexto Dynamics del cookie antes de observar auth state
    const dynCookie = getCookie('nexo-dynamics-user')
    if (dynCookie) {
      try {
        const parsed = JSON.parse(dynCookie) as DynamicsUser
        setDynamicsUser(parsed)
        setIsEmbed(true)
      } catch { /* ignorar */ }
    }

    // 2. Si hay nexo-embed-token, iniciar sesión con custom token de Firebase
    const embedToken = getCookie('nexo-embed-token')
    if (embedToken) {
      deleteCookie('nexo-embed-token') // usar una sola vez
      signInWithCustomToken(auth, embedToken).catch(console.error)
    }

    // 3. Observar cambios en auth state
    const unsub = onAuthStateChanged(auth, u => {
      setUser(u)
      setLoading(false)
    })
    return unsub
  }, [])

  const login  = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password)
  }
  const logout = async () => signOut(auth)

  return (
    <AuthContext.Provider value={{ user, loading, isEmbed, dynamicsUser, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
