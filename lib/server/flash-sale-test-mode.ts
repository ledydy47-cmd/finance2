import { kvRestDel, kvRestGetJson, kvRestSet } from "@/lib/server/kv-rest"

const testKey = (userKey: string) => `kopilka:flash-sale-test:${userKey}`

export interface FlashSaleTestSession {
  userKey: string
  startedAt: string
  saleDurationMs: number
  reminderDelayMs: number
  reoffer4hMs: number
  reoffer24hMs: number
  createdAt: string
}

/** Short delays for admin testing (~30s / ~2min / ~3min total). */
export const FLASH_SALE_TEST_DELAYS: Omit<FlashSaleTestSession, "userKey" | "startedAt" | "createdAt"> = {
  saleDurationMs: 60_000,
  reminderDelayMs: 30_000,
  reoffer4hMs: 60_000,
  reoffer24hMs: 120_000,
}

export async function setFlashSaleTestSession(
  userKey: string,
  startedAt: string,
  delays: Omit<FlashSaleTestSession, "userKey" | "startedAt" | "createdAt"> = FLASH_SALE_TEST_DELAYS,
) {
  const session: FlashSaleTestSession = {
    userKey,
    startedAt,
    createdAt: new Date().toISOString(),
    ...delays,
  }
  await kvRestSet(testKey(userKey), JSON.stringify(session))
  return session
}

export async function getFlashSaleTestSession(userKey: string) {
  return kvRestGetJson<FlashSaleTestSession | null>(testKey(userKey), null)
}

export async function clearFlashSaleTestSession(userKey: string) {
  const deleted = await kvRestDel(testKey(userKey))
  if (deleted) return true
  return kvRestSet(testKey(userKey), "")
}

export function isFlashSaleTestSession(session: FlashSaleTestSession | null, startedAt: string) {
  return Boolean(session && session.startedAt === startedAt)
}
