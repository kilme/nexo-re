'use client'
import { db } from './firebase'
import {
  collection, doc, getDocs, getDoc,
  query, orderBy, where,
} from 'firebase/firestore'
import type { Property, Listing } from '@/types'

// ─── Properties ───────────────────────────────────────────────────────────────

const propertiesRef = () => collection(db, 'properties')

export async function getProperties(): Promise<Property[]> {
  const q    = query(propertiesRef(), where('status', '==', 'active'), orderBy('createdAt', 'desc'))
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Property))
}

export async function getProperty(id: string): Promise<Property | null> {
  const snap = await getDoc(doc(db, 'properties', id))
  if (!snap.exists()) return null
  return { id: snap.id, ...snap.data() } as Property
}

// ─── Listings ─────────────────────────────────────────────────────────────────

const listingsRef = () => collection(db, 'listings')

export async function getListings(): Promise<Listing[]> {
  const q    = query(listingsRef(), where('status', '==', 'active'), orderBy('createdAt', 'desc'))
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Listing))
}

export async function getListing(id: string): Promise<Listing | null> {
  const snap = await getDoc(doc(db, 'listings', id))
  if (!snap.exists()) return null
  return { id: snap.id, ...snap.data() } as Listing
}
