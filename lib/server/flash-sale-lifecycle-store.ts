import { kvRestGetJson, kvRestSet } from "@/lib/server/kv-rest"

const lifecycleKey = (userKey: string) => `kopilka:flash-sale-lifecycle:${userKey}`
const INDEX_KEY = "kopilka:flash-sale-lifecycle-index"

export type FlashSalePendingOffer = "4h" | "24h"

export interface FlashSaleLifecycle {
  userKey: string
  startedAt: string
  expiredAt: string | null
  pendingOffer: FlashSalePendingOffer | null
  offer4hSentAt: string | null
  offer24hSentAt: string | null
}

function emptyLifecycle(userKey: string, startedAt: string): FlashSaleLifecycle {
  return {
    userKey,
    startedAt,
    expiredAt: null,
    pendingOffer: null,
    offer4hSentAt: null,
    offer24hSentAt: null,
  }
}

export async function readLifecycleIndex() {
  return kvRestGetJson<string[]>(INDEX_KEY, [])
}

async function writeLifecycleIndex(userKeys: string[]) {
  return kvRestSet(INDEX_KEY, JSON.stringify([...new Set(userKeys)]))
}

export async function getFlashSaleLifecycle(userKey: string) {
  return kvRestGetJson<FlashSaleLifecycle | null>(lifecycleKey(userKey), null)
}

export async function saveFlashSaleLifecycle(lifecycle: FlashSaleLifecycle) {
  const wrote = await kvRestSet(lifecycleKey(lifecycle.userKey), JSON.stringify(lifecycle))
  if (!wrote) return false

  const index = await readLifecycleIndex()
  if (!index.includes(lifecycle.userKey)) {
    await writeLifecycleIndex([...index, lifecycle.userKey])
  }
  return true
}

export async function registerFlashSaleLifecycle(userKey: string, startedAt: string) {
  const existing = await getFlashSaleLifecycle(userKey)
  if (existing) {
    existing.startedAt = startedAt
    if (!existing.pendingOffer) {
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
  await kvRestSet(lifecycleKey(userKey), "")
  const index = await readLifecycleIndex()
  await writeLifecycleIndex(index.filter((item) => item !== userKey))
}

export async function listTrackedFlashSaleLifecycles() {
  const index = await readLifecycleIndex()
  const lifecycles: FlashSaleLifecycle[] = []

  for (const userKey of index) {
    const lifecycle = await getFlashSaleLifecycle(userKey)
    if (!lifecycle) continue
    lifecycles.push(lifecycle)
  }

  return lifecycles
}
