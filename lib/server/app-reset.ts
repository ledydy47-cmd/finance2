import type { AppData, Settings } from "@/lib/types"
import { kvRestGet, kvRestSet } from "@/lib/server/kv-rest"

const resetKey = (userKey: string) => `kopilka:app-reset:${userKey}`

export interface AppResetPayload {
  resetId: string
  createdAt: string
  settingsPatch: Partial<Settings>
  clearExpenseTransactions: boolean
}

export async function queueAppReset(input: {
  userKey: string
  settingsPatch?: Partial<Settings>
  clearExpenseTransactions?: boolean
}) {
  const payload: AppResetPayload = {
    resetId: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    settingsPatch: input.settingsPatch ?? {},
    clearExpenseTransactions: input.clearExpenseTransactions ?? false,
  }

  const wrote = await kvRestSet(resetKey(input.userKey), JSON.stringify(payload))
  if (!wrote) {
    throw new Error("Failed to queue app reset")
  }

  return payload
}

export async function consumeAppReset(userKey: string) {
  const raw = await kvRestGet(resetKey(userKey))
  if (!raw) return null

  await kvRestSet(resetKey(userKey), "")

  try {
    return JSON.parse(raw) as AppResetPayload
  } catch {
    return null
  }
}

export function applyAppReset(data: AppData, reset: AppResetPayload): AppData {
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
  isSubscribed: false,
  subscriptionPlan: null,
  subscriptionExpiresAt: null,
  lastPaymentId: null,
  autoRenew: true,
  subscriptionStatus: undefined,
}
