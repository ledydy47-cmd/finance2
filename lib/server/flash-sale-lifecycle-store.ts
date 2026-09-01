import { eq } from "drizzle-orm"
import { getDb, hasTursoConfig } from "@/lib/db/client"
import { initTursoSchema } from "@/lib/db/init"
import { flashSaleLifecycleToRecord, flashSaleLifecycleToRow } from "@/lib/db/mappers"
import { flashSaleLifecycle as flashSaleLifecycleTable } from "@/lib/db/schema"
import { readJsonDataFile, writeJsonDataFile } from "@/lib/server/file-store"
import { hasKvRestConfig, kvRestGetJson, kvRestSet } from "@/lib/server/kv-rest"

const FILE_NAME = "flash-sale-lifecycle.json"
const lifecycleKey = (userKey: string) => `kopilka:flash-sale-lifecycle:${userKey}`
const INDEX_KEY = "kopilka:flash-sale-lifecycle-index"

export type FlashSalePendingOffer = "1h" | "4h" | "24h"

export interface FlashSaleLifecycle {
  userKey: string
  startedAt: string
  expiredAt: string | null
  pendingOffer: FlashSalePendingOffer | null
  promotionId: string | null
  pendingPromotionId: string | null
  offer4hSentAt: string | null
  offer24hSentAt: string | null
}

interface FlashSaleLifecycleSnapshot {
  lifecycles: Record<string, FlashSaleLifecycle>
}

const EMPTY_SNAPSHOT: FlashSaleLifecycleSnapshot = { lifecycles: {} }

let schemaReady = false

async function ensureTursoSchema() {
  if (!schemaReady) {
    await initTursoSchema()
    schemaReady = true
  }
}

function emptyLifecycle(userKey: string, startedAt: string): FlashSaleLifecycle {
  return {
    userKey,
    startedAt,
    expiredAt: null,
    pendingOffer: null,
    promotionId: null,
    pendingPromotionId: null,
    offer4hSentAt: null,
    offer24hSentAt: null,
  }
}

async function readFileSnapshot() {
  return readJsonDataFile(FILE_NAME, EMPTY_SNAPSHOT)
}

async function writeFileSnapshot(snapshot: FlashSaleLifecycleSnapshot) {
  await writeJsonDataFile(FILE_NAME, snapshot)
}

export async function readLifecycleIndex() {
  if (hasTursoConfig()) {
    await ensureTursoSchema()
    const rows = await getDb().select({ userKey: flashSaleLifecycleTable.userKey }).from(flashSaleLifecycleTable)
    return rows.map((row) => row.userKey)
  }

  if (hasKvRestConfig()) {
    return kvRestGetJson<string[]>(INDEX_KEY, [])
  }

  const snapshot = await readFileSnapshot()
  return Object.keys(snapshot.lifecycles)
}

export async function getFlashSaleLifecycle(userKey: string) {
  if (hasTursoConfig()) {
    await ensureTursoSchema()
    const row = await getDb()
      .select()
      .from(flashSaleLifecycleTable)
      .where(eq(flashSaleLifecycleTable.userKey, userKey))
      .get()
    return row ? flashSaleLifecycleToRecord(row) : null
  }

  if (hasKvRestConfig()) {
    return kvRestGetJson<FlashSaleLifecycle | null>(lifecycleKey(userKey), null)
  }

  const snapshot = await readFileSnapshot()
  return snapshot.lifecycles[userKey] ?? null
}

export async function saveFlashSaleLifecycle(lifecycle: FlashSaleLifecycle) {
  if (hasTursoConfig()) {
    await ensureTursoSchema()
    await getDb()
      .insert(flashSaleLifecycleTable)
      .values(flashSaleLifecycleToRow(lifecycle))
      .onConflictDoUpdate({
        target: flashSaleLifecycleTable.userKey,
        set: flashSaleLifecycleToRow(lifecycle),
      })
    return true
  }

  if (hasKvRestConfig()) {
    const wrote = await kvRestSet(lifecycleKey(lifecycle.userKey), JSON.stringify(lifecycle))
    if (wrote) {
      const index = await readLifecycleIndex()
      if (!index.includes(lifecycle.userKey)) {
        await kvRestSet(INDEX_KEY, JSON.stringify([...index, lifecycle.userKey]))
      }
      return true
    }
    return false
  }

  const snapshot = await readFileSnapshot()
  snapshot.lifecycles[lifecycle.userKey] = lifecycle
  await writeFileSnapshot(snapshot)
  return true
}

export async function registerFlashSaleLifecycle(userKey: string, startedAt: string) {
  const existing = await getFlashSaleLifecycle(userKey)
  if (existing) {
    const isNewSale = existing.startedAt !== startedAt
    if (isNewSale) {
      existing.startedAt = startedAt
      existing.expiredAt = null
      existing.offer4hSentAt = null
      existing.offer24hSentAt = null
      existing.pendingOffer = null
      existing.pendingPromotionId = null
    } else if (!existing.pendingOffer && !existing.pendingPromotionId) {
      existing.expiredAt = null
    }
    await saveFlashSaleLifecycle(existing)
    return existing
  }

  const lifecycle = emptyLifecycle(userKey, startedAt)
  await saveFlashSaleLifecycle(lifecycle)
  return lifecycle
}

export async function clearFlashSaleLifecycle(userKey: string) {
  if (hasTursoConfig()) {
    await ensureTursoSchema()
    await getDb().delete(flashSaleLifecycleTable).where(eq(flashSaleLifecycleTable.userKey, userKey))
    return
  }

  if (hasKvRestConfig()) {
    await kvRestSet(lifecycleKey(userKey), "")
    const index = await readLifecycleIndex()
    await kvRestSet(INDEX_KEY, JSON.stringify(index.filter((item) => item !== userKey)))
    return
  }

  const snapshot = await readFileSnapshot()
  delete snapshot.lifecycles[userKey]
  await writeFileSnapshot(snapshot)
}

export async function listTrackedFlashSaleLifecycles() {
  if (hasTursoConfig()) {
    await ensureTursoSchema()
    const rows = await getDb().select().from(flashSaleLifecycleTable)
    return rows.map(flashSaleLifecycleToRecord)
  }

  const index = await readLifecycleIndex()
  const lifecycles: FlashSaleLifecycle[] = []

  for (const userKey of index) {
    const lifecycle = await getFlashSaleLifecycle(userKey)
    if (!lifecycle) continue
    lifecycles.push(lifecycle)
  }

  return lifecycles
}
