'use client'
import { createContext, useContext, useEffect, useState } from 'react'
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, User } from 'firebase/auth'
import { auth } from './firebase'

interface AuthContextType {
  user: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null, loading: true,
  login: async () => {}, logout: async () => {},
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser]       = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, u => { setUser(u); setLoading(false) })
    return unsub
  }, [])

  const login  = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password)
  }
  const logout = async () => signOut(auth)

  return <AuthContext.Provider value={{ user, loading, login, logout }}>{children}</AuthContext.Provider>
}

export const useAuth = () => useContext(AuthContext)
