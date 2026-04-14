/**
 * Migración de datos: captura-aa00a → nexo-re
 *
 * Uso:
 *   node scripts/migrate-firebase.mjs
 *
 * Requiere:
 *   - SERVICE_ACCOUNT_OLD : JSON de la service account de captura-aa00a
 *   - SERVICE_ACCOUNT_NEW : JSON de la service account de nexo-re (ya en .env.local)
 *
 * Colecciones migradas: listings, properties, audit_logs
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

// ─── Credenciales ─────────────────────────────────────────────────────────────

// Service account viejo (captura-aa00a) — pegalo acá o ponelo en variable de entorno
const SA_OLD = process.env.SA_OLD
  ? JSON.parse(process.env.SA_OLD)
  : {
      // Pegá el JSON de captura-aa00a acá si no usás variable de entorno
    }

// Service account nuevo (nexo-re) — viene del .env.local
const SA_NEW = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '{}')

if (!SA_OLD?.project_id) {
  console.error('❌  Falta SA_OLD — pasalo como variable de entorno o pegalo en el script.')
  process.exit(1)
}
if (!SA_NEW?.project_id) {
  console.error('❌  Falta FIREBASE_SERVICE_ACCOUNT en el entorno.')
  process.exit(1)
}

// ─── Init ─────────────────────────────────────────────────────────────────────

const oldApp = initializeApp({ credential: cert(SA_OLD) }, 'old')
const newApp = initializeApp({ credential: cert(SA_NEW) }, 'new')

const dbOld = getFirestore(oldApp)
const dbNew = getFirestore(newApp)

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function migrateCollection(name) {
  console.log(`\n📦  Migrando colección: ${name}`)
  const snap = await dbOld.collection(name).get()

  if (snap.empty) {
    console.log(`   Sin documentos.`)
    return
  }

  const batch = dbNew.batch()
  let count = 0

  for (const doc of snap.docs) {
    const ref = dbNew.collection(name).doc(doc.id)
    batch.set(ref, doc.data())
    count++

    // Firestore admite hasta 500 ops por batch
    if (count % 499 === 0) {
      await batch.commit()
      console.log(`   ✓ ${count} documentos commiteados...`)
    }
  }

  await batch.commit()
  console.log(`   ✓ ${count} documentos migrados.`)
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`🚀  Iniciando migración`)
  console.log(`   Origen : ${SA_OLD.project_id}`)
  console.log(`   Destino: ${SA_NEW.project_id}`)

  await migrateCollection('listings')
  await migrateCollection('properties')
  await migrateCollection('audit_logs')

  console.log('\n✅  Migración completada.')
}

main().catch(err => {
  console.error('❌  Error:', err)
  process.exit(1)
})
