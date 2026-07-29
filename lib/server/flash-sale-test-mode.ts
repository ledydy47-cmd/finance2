import { eq } from "drizzle-orm"
import { getDb, hasTursoConfig } from "@/lib/db/client"
import { initTursoSchema } from "@/lib/db/init"
import { flashSaleTestSessionToRecord } from "@/lib/db/mappers"
import { flashSaleTestSessions } from "@/lib/db/schema"
import { readJsonDataFile, writeJsonDataFile } from "@/lib/server/file-store"
import { hasKvRestConfig, kvRestDel, kvRestGetJson, kvRestSet } from "@/lib/server/kv-rest"

const FILE_NAME = "flash-sale-test-sessions.json"
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

interface FlashSaleTestSnapshot {
  sessions: Record<string, FlashSaleTestSession>
}

const EMPTY_SNAPSHOT: FlashSaleTestSnapshot = { sessions: {} }

let schemaReady = false

async function ensureTursoSchema() {
  if (!schemaReady) {
    await initTursoSchema()
    schemaReady = true
  }
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

  if (hasTursoConfig()) {
    await ensureTursoSchema()
    await getDb()
      .insert(flashSaleTestSessions)
      .values({
        userKey: session.userKey,
        startedAt: session.startedAt,
        saleDurationMs: session.saleDurationMs,
        reminderDelayMs: session.reminderDelayMs,
        reoffer4hMs: session.reoffer4hMs,
        reoffer24hMs: session.reoffer24hMs,
        createdAt: session.createdAt,
      })
      .onConflictDoUpdate({
        target: flashSaleTestSessions.userKey,
        set: {
          startedAt: session.startedAt,
          saleDurationMs: session.saleDurationMs,
          reminderDelayMs: session.reminderDelayMs,
          reoffer4hMs: session.reoffer4hMs,
          reoffer24hMs: session.reoffer24hMs,
          createdAt: session.createdAt,
        },
      })
    return session
  }

  if (hasKvRestConfig()) {
    await kvRestSet(testKey(userKey), JSON.stringify(session))
    return session
  }

  const snapshot = await readJsonDataFile(FILE_NAME, EMPTY_SNAPSHOT)
  snapshot.sessions[userKey] = session
  await writeJsonDataFile(FILE_NAME, snapshot)
  return session
}

export async function getFlashSaleTestSession(userKey: string) {
  if (hasTursoConfig()) {
    await ensureTursoSchema()
    const row = await getDb()
      .select()
      .from(flashSaleTestSessions)
      .where(eq(flashSaleTestSessions.userKey, userKey))
      .get()
    return row ? flashSaleTestSessionToRecord(row) : null
  }

  if (hasKvRestConfig()) {
    return kvRestGetJson<FlashSaleTestSession | null>(testKey(userKey), null)
  }

  const snapshot = await readJsonDataFile(FILE_NAME, EMPTY_SNAPSHOT)
  return snapshot.sessions[userKey] ?? null
}

export async function clearFlashSaleTestSession(userKey: string) {
  if (hasTursoConfig()) {
    await ensureTursoSchema()
    await getDb().delete(flashSaleTestSessions).where(eq(flashSaleTestSessions.userKey, userKey))
    return true
  }

  if (hasKvRestConfig()) {
    const deleted = await kvRestDel(testKey(userKey))
    if (deleted) return true
    return kvRestSet(testKey(userKey), "")
  }

  const snapshot = await readJsonDataFile(FILE_NAME, EMPTY_SNAPSHOT)
  delete snapshot.sessions[userKey]
  await writeJsonDataFile(FILE_NAME, snapshot)
  return true
}

export function isFlashSaleTestSession(session: FlashSaleTestSession | null, startedAt: string) {
  return Boolean(session && session.startedAt === startedAt)
}
