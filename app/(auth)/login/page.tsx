'use client'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

// El portal no requiere login — redirigir siempre al portal.
export default function LoginPage() {
  const router = useRouter()
  useEffect(() => { router.replace('/properties') }, [router])
  return (
    <div className="min-h-screen bg-dyn-light flex items-center justify-center">
      <div className="w-5 h-5 border-2 border-dyn border-t-transparent rounded-full animate-spin" />
    </div>
  )
}
