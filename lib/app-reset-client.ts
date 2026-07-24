import type { AppData, Settings } from "@/lib/types"

export interface RemoteAppResetPayload {
  resetId: string
  settingsPatch: Partial<Settings>
  clearExpenseTransactions: boolean
  resetToOnboarding?: boolean
}

const APPLIED_RESET_KEY = "kopilka-applied-reset-id"

export function getAppliedResetId() {
  if (typeof window === "undefined") return null
  return localStorage.getItem(APPLIED_RESET_KEY)
}

export function markResetApplied(resetId: string) {
  if (typeof window === "undefined") return
  localStorage.setItem(APPLIED_RESET_KEY, resetId)
}

export function applyRemoteAppReset(data: AppData, reset: RemoteAppResetPayload): AppData {
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

  return {
    ...data,
    settings: {
      ...data.settings,
      ...reset.settingsPatch,
    },
    transactions: reset.clearExpenseTransactions
      ? data.transactions.filter((tx) => tx.type !== "expense")
      : data.transactions,
  }
}

export async function fetchPendingAppReset(userKey: string) {
  const response = await fetch(
    `/api/user/app-reset?userKey=${encodeURIComponent(userKey)}`,
    { cache: "no-store" },
  )
  if (!response.ok) return null

  const payload = (await response.json()) as {
    apply?: boolean
    resetId?: string
    settingsPatch?: Partial<Settings>
    clearExpenseTransactions?: boolean
    resetToOnboarding?: boolean
  }

  if (!payload.apply || !payload.resetId) return null
  if (getAppliedResetId() === payload.resetId) return null

  return {
    resetId: payload.resetId,
    settingsPatch: payload.settingsPatch ?? {},
    clearExpenseTransactions: payload.clearExpenseTransactions ?? false,
    resetToOnboarding: payload.resetToOnboarding ?? false,
  } satisfies RemoteAppResetPayload
}
