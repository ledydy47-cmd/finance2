import type { Settings } from "@/lib/types"

export function isUserSubscribed(settings: Settings) {
  if (settings.isSubscribed) return true
  if (settings.subscriptionExpiresAt) {
    return new Date(settings.subscriptionExpiresAt).getTime() > Date.now()
  }
  return false
}

export const FLASH_SALE_DURATION_MS = 15 * 60 * 1000
export const FLASH_SALE_REMINDER_BEFORE_MS = 5 * 60 * 1000

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

export function getFlashSaleState(settings: Settings, now = Date.now()) {
  if (isUserSubscribed(settings) || !settings.paywallFlashSaleStartedAt) {
    return { active: false as const }
  }

  const startedAt = new Date(settings.paywallFlashSaleStartedAt).getTime()
  if (Number.isNaN(startedAt)) {
    return { active: false as const }
  }

  const remainingMs = FLASH_SALE_DURATION_MS - (now - startedAt)
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
  showPaywallOnFirstExpense: boolean
} {
  const subscribed = isUserSubscribed(settings)
  const usedFreeExpense = settings.firstExpenseAdded

  return {
    isContentLocked: usedFreeExpense && !subscribed,
    requiresPremiumAfterWalkthrough:
      settings.homeWalkthroughCompleted && usedFreeExpense && !subscribed,
    showPaywallOnFirstExpense: false,
  }
}
