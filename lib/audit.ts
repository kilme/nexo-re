import { db } from './firebase'
import { collection, addDoc, serverTimestamp } from 'firebase/firestore'

export type AuditAction =
  | 'view_properties'
  | 'view_listings'
  | 'view_map'
  | 'view_property_detail'
  | 'view_listing_detail'
  | 'map_search'
  | 'export_excel'
  | 'export_pdf'
  | 'export_word'

export interface AuditMeta {
  resourceId?:   string
  resourceName?: string
  query?:        string
  [key: string]: unknown
}

/**
 * Registra una acción de usuario en Firestore (colección audit_logs).
 * No lanza excepciones — falla silenciosamente para no interrumpir el flujo.
 */
export async function logActivity(
  dynamicsGuid: string,
  dynamicsName: string,
  action: AuditAction,
  meta?: AuditMeta
) {
  try {
    await addDoc(collection(db, 'audit_logs'), {
      dynamicsGuid,
      dynamicsName,
      action,
      meta:      meta ?? {},
      timestamp: serverTimestamp(),
    })
  } catch (e) {
    console.warn('[audit] log failed:', e)
  }
}
