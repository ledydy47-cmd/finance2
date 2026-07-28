import type { Settings, Transaction } from "@/lib/types"

export function countExpenseTransactions(transactions: Transaction[]) {
  return transactions.filter((tx) => tx.type === "expense").length
}

export function hasSavedExpense(transactions: Transaction[]) {
  return countExpenseTransactions(transactions) > 0
}

export function isUserSubscribed(settings: Settings) {
  if (settings.isSubscribed) return true
  if (settings.subscriptionExpiresAt) {
    return new Date(settings.subscriptionExpiresAt).getTime() > Date.now()
  }
  return false
}

export const FLASH_SALE_DURATION_MS = 15 * 60 * 1000
/** Bot reminder: 10 minutes after the first paywall / flash sale start. */
export const FLASH_SALE_REMINDER_DELAY_MS = 10 * 60 * 1000
export const FLASH_SALE_REMINDER_BEFORE_MS = 5 * 60 * 1000
export const FLASH_SALE_REOFFER_4H_MS = 4 * 60 * 60 * 1000
export const FLASH_SALE_REOFFER_24H_MS = 24 * 60 * 60 * 1000

export const FLASH_SALE_LIST_PRICES = {
  yearly: {
    total: 2980,
    perMonth: 248,
  },
  monthly: {
    perMonth: 598,
  },
} as const

export const FLASH_SALE_SALE_PRICES = {
  yearly: {
    total: 1490,
    perMonth: 124,
  },
  monthly: {
    perMonth: 299,
  },
} as const

function formatCountdown(remainingMs: number) {
  const totalSeconds = Math.max(0, Math.ceil(remainingMs / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
}

export function getFlashSaleState(
  settings: Settings,
  now = Date.now(),
  durationMs = settings.flashSaleDurationMs ?? FLASH_SALE_DURATION_MS,
) {
  if (isUserSubscribed(settings) || !settings.paywallFlashSaleStartedAt) {
    return { active: false as const }
  }

  const startedAt = new Date(settings.paywallFlashSaleStartedAt).getTime()
  if (Number.isNaN(startedAt)) {
    return { active: false as const }
  }

  const remainingMs = durationMs - (now - startedAt)
  if (remainingMs <= 0) {
    return { active: false as const, expired: true as const }
  }

  return {
    active: true as const,
    remainingMs,
    countdownLabel: formatCountdown(remainingMs),
    listPrices: FLASH_SALE_LIST_PRICES,
    salePrices: FLASH_SALE_SALE_PRICES,
  }
}

export function resolvePaywallAccess(settings: Settings): {
  isContentLocked: boolean
  requiresPremiumAfterWalkthrough: boolean
} {
  const subscribed = isUserSubscribed(settings)
  const paywallActive = settings.paywallShown && !subscribed

  return {
    isContentLocked: paywallActive,
    requiresPremiumAfterWalkthrough:
      paywallActive && settings.homeWalkthroughCompleted,
  }
}

export function isAddingFirstExpense(transactions: Transaction[], type: Transaction["type"]) {
  return type === "expense" && countExpenseTransactions(transactions) === 0
}

export function isAddingSecondExpenseAttempt(
  transactions: Transaction[],
  type: Transaction["type"],
  settings: Settings,
) {
  return (
    type === "expense" &&
    countExpenseTransactions(transactions) >= 1 &&
    !isUserSubscribed(settings)
  )
}
