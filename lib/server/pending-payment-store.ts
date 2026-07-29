import { eq } from "drizzle-orm"
import { getDb, hasTursoConfig } from "@/lib/db/client"
import { initTursoSchema } from "@/lib/db/init"
import { pendingPaymentToRecord } from "@/lib/db/mappers"
import { pendingPayments } from "@/lib/db/schema"
import { readJsonDataFile, writeJsonDataFile } from "@/lib/server/file-store"
import { hasKvRestConfig, kvRestDel, kvRestGet, kvRestGetJson, kvRestSet } from "@/lib/server/kv-rest"
import type { SubscriptionPlan } from "@/lib/subscription"

const FILE_NAME = "pending-payments.json"

const pendingKey = (userKey: string) => `kopilka:pending-payment:${userKey}`
const orderKey = (orderId: string) => `kopilka:pending-order:${orderId}`
const paymentOwnerKey = (paymentId: string) => `kopilka:payment-owner:${paymentId}`

export interface PendingPaymentRecord {
  paymentId: string
  userKey: string
  plan: SubscriptionPlan
  orderId: string
  createdAt: string
}

interface PendingPaymentStoreSnapshot {
  byUserKey: Record<string, PendingPaymentRecord>
  byOrderId: Record<string, PendingPaymentRecord>
  paymentOwners: Record<string, string>
}

const EMPTY_STORE: PendingPaymentStoreSnapshot = {
  byUserKey: {},
  byOrderId: {},
  paymentOwners: {},
}

let schemaReady = false

async function ensureTursoSchema() {
  if (!schemaReady) {
    await initTursoSchema()
    schemaReady = true
  }
}

async function readFileStore() {
  return readJsonDataFile(FILE_NAME, EMPTY_STORE)
}

async function writeFileStore(snapshot: PendingPaymentStoreSnapshot) {
  await writeJsonDataFile(FILE_NAME, snapshot)
}

function upsertInSnapshot(snapshot: PendingPaymentStoreSnapshot, record: PendingPaymentRecord) {
  snapshot.byUserKey[record.userKey] = record
  snapshot.byOrderId[record.orderId] = record
  snapshot.paymentOwners[record.paymentId] = record.userKey
}

function removeFromSnapshot(
  snapshot: PendingPaymentStoreSnapshot,
  userKey: string,
  paymentId?: string,
  orderId?: string,
) {
  delete snapshot.byUserKey[userKey]
  if (orderId) delete snapshot.byOrderId[orderId]
  if (paymentId) delete snapshot.paymentOwners[paymentId]
}

export async function savePendingPayment(record: PendingPaymentRecord) {
  if (hasTursoConfig()) {
    await ensureTursoSchema()
    await getDb()
      .insert(pendingPayments)
      .values({
        userKey: record.userKey,
        paymentId: record.paymentId,
        orderId: record.orderId,
        plan: record.plan,
        createdAt: record.createdAt,
      })
      .onConflictDoUpdate({
        target: pendingPayments.userKey,
        set: {
          paymentId: record.paymentId,
          orderId: record.orderId,
          plan: record.plan,
          createdAt: record.createdAt,
        },
      })
    return record
  }

  if (hasKvRestConfig()) {
    await kvRestSet(pendingKey(record.userKey), JSON.stringify(record))
    await kvRestSet(orderKey(record.orderId), JSON.stringify(record))
    await kvRestSet(paymentOwnerKey(record.paymentId), record.userKey)
  }

  const store = await readFileStore()
  upsertInSnapshot(store, record)
  await writeFileStore(store)
  return record
}

export async function getPendingPaymentByOrderId(orderId: string) {
  if (hasTursoConfig()) {
    await ensureTursoSchema()
    const row = await getDb()
      .select()
      .from(pendingPayments)
      .where(eq(pendingPayments.orderId, orderId))
      .get()
    return row ? pendingPaymentToRecord(row) : null
  }

  if (hasKvRestConfig()) {
    const fromKv = await kvRestGetJson<PendingPaymentRecord | null>(orderKey(orderId), null)
    if (fromKv) return fromKv
  }

  const store = await readFileStore()
  return store.byOrderId[orderId] ?? null
}

export async function getPendingPayment(userKey: string) {
  if (hasTursoConfig()) {
    await ensureTursoSchema()
    const row = await getDb()
      .select()
      .from(pendingPayments)
      .where(eq(pendingPayments.userKey, userKey))
      .get()
    return row ? pendingPaymentToRecord(row) : null
  }

  if (hasKvRestConfig()) {
    const fromKv = await kvRestGetJson<PendingPaymentRecord | null>(pendingKey(userKey), null)
    if (fromKv) return fromKv
  }

  const store = await readFileStore()
  return store.byUserKey[userKey] ?? null
}

export async function getPendingPaymentOwner(paymentId: string) {
  if (hasTursoConfig()) {
    await ensureTursoSchema()
    const row = await getDb()
      .select()
      .from(pendingPayments)
      .where(eq(pendingPayments.paymentId, paymentId))
      .get()
    return row?.userKey ?? null
  }

  if (hasKvRestConfig()) {
    const fromKv = await kvRestGet(paymentOwnerKey(paymentId))
    if (fromKv) return fromKv
  }

  const store = await readFileStore()
  return store.paymentOwners[paymentId] ?? null
}

export async function clearPendingPayment(userKey: string, paymentId?: string) {
  const pending = await getPendingPayment(userKey)
  const resolvedPaymentId = paymentId ?? pending?.paymentId
  const resolvedOrderId = pending?.orderId

  if (hasTursoConfig()) {
    await ensureTursoSchema()
    await getDb().delete(pendingPayments).where(eq(pendingPayments.userKey, userKey))
    return
  }

  if (hasKvRestConfig()) {
    await kvRestDel(pendingKey(userKey))
    if (resolvedPaymentId) await kvRestDel(paymentOwnerKey(resolvedPaymentId))
    if (resolvedOrderId) await kvRestDel(orderKey(resolvedOrderId))
  }

  const store = await readFileStore()
  removeFromSnapshot(store, userKey, resolvedPaymentId, resolvedOrderId)
  await writeFileStore(store)
}
