import { getApps, initializeApp, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { getAuth } from 'firebase-admin/auth'

function initAdmin() {
  if (getApps().length > 0) return getApps()[0]
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT!
  const sa  = JSON.parse(raw)
  return initializeApp({ credential: cert(sa) })
}

export const adminDb   = () => getFirestore(initAdmin())
export const adminAuth = () => getAuth(initAdmin())
