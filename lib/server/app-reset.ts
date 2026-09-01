import { eq } from "drizzle-orm"
import type { AppData, Settings } from "@/lib/types"
import { getDb, hasTursoConfig } from "@/lib/db/client"
import { initTursoSchema } from "@/lib/db/init"
import { appResets } from "@/lib/db/schema"
import { readJsonDataFile, writeJsonDataFile } from "@/lib/server/file-store"
import { kvRestGet, kvRestSet } from "@/lib/server/kv-rest"

const FILE_NAME = "app-resets.json"
const resetKey = (userKey: string) => `kopilka:app-reset:${userKey}`

export interface AppResetPayload {
  resetId: string
  createdAt: string
  settingsPatch: Partial<Settings>
  clearExpenseTransactions: boolean
  resetToOnboarding?: boolean
}

interface AppResetSnapshot {
  byUserKey: Record<string, AppResetPayload>
}

const EMPTY_SNAPSHOT: AppResetSnapshot = { byUserKey: {} }

let schemaReady = false

async function ensureTursoSchema() {
  if (!schemaReady) {
    await initTursoSchema()
    schemaReady = true
  }
}

export async function queueAppReset(input: {
  userKey: string
  settingsPatch?: Partial<Settings>
  clearExpenseTransactions?: boolean
  resetToOnboarding?: boolean
}) {
  const payload: AppResetPayload = {
    resetId: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    settingsPatch: input.settingsPatch ?? {},
    clearExpenseTransactions: input.clearExpenseTransactions ?? false,
    resetToOnboarding: input.resetToOnboarding ?? false,
  }

  if (hasTursoConfig()) {
    await ensureTursoSchema()
    await getDb()
      .insert(appResets)
      .values({
        userKey: input.userKey,
        payloadJson: JSON.stringify(payload),
      })
      .onConflictDoUpdate({
        target: appResets.userKey,
        set: { payloadJson: JSON.stringify(payload) },
      })
    return payload
  }

  const wrote = await kvRestSet(resetKey(input.userKey), JSON.stringify(payload))
  if (!wrote) {
    const snapshot = await readJsonDataFile(FILE_NAME, EMPTY_SNAPSHOT)
    snapshot.byUserKey[input.userKey] = payload
    await writeJsonDataFile(FILE_NAME, snapshot)
  }

  return payload
}

export async function consumeAppReset(userKey: string) {
  if (hasTursoConfig()) {
    await ensureTursoSchema()
    const row = await getDb().select().from(appResets).where(eq(appResets.userKey, userKey)).get()
    if (!row) return null
    await getDb().delete(appResets).where(eq(appResets.userKey, userKey))
    try {
      return JSON.parse(row.payloadJson) as AppResetPayload
    } catch {
      return null
    }
  }

  const raw = await kvRestGet(resetKey(userKey))
  if (!raw) {
    const snapshot = await readJsonDataFile(FILE_NAME, EMPTY_SNAPSHOT)
    const payload = snapshot.byUserKey[userKey]
    if (!payload) return null
    delete snapshot.byUserKey[userKey]
    await writeJsonDataFile(FILE_NAME, snapshot)
    return payload
  }

  await kvRestSet(resetKey(userKey), "")

  try {
    return JSON.parse(raw) as AppResetPayload
  } catch {
    return null
  }
}

export function applyAppReset(data: AppData, reset: AppResetPayload): AppData {
  if (reset.resetToOnboarding) {
    return {
      ...data,
      goals: [],
      categories: [],
      transactions: [],
      budgetPlan: undefined,
      settings: {
        ...data.settings,
        ...reset.settingsPatch,
        primaryGoalId: null,
      },
    }
  }

  const next: AppData = {
    ...data,
    settings: {
      ...data.settings,
      ...reset.settingsPatch,
    },
    transactions: reset.clearExpenseTransactions
      ? data.transactions.filter((tx) => tx.type !== "expense")
      : data.transactions,
  }

  return next
}

export const WALKTHROUGH_RESET_PATCH: Partial<Settings> = {
  homeWalkthroughCompleted: false,
  paywallShown: false,
  firstExpenseAdded: false,
  paywallFlashSaleStartedAt: null,
  paywallPromotionId: null,
  isSubscribed: false,
  subscriptionPlan: null,
  subscriptionExpiresAt: null,
  lastPaymentId: null,
  autoRenew: true,
  subscriptionStatus: undefined,
}

export const ONBOARDING_RESET_PATCH: Partial<Settings> = {
  ...WALKTHROUGH_RESET_PATCH,
  onboardingCompleted: false,
  primaryGoalId: null,
}
