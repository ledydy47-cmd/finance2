import type { Settings, Transaction } from "@/lib/types"
import {
  getPaywallPromotion,
  getPromotionRemainingMs,
  isPromotionActive,
} from "@/lib/paywall-promotions"

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
/** Bot re-offer: 1 hour after the user taps «Начать» in onboarding. */
export const ONBOARDING_REOFFER_1H_MS = 60 * 60 * 1000

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

function formatPromotionCountdown(remainingMs: number) {
  const totalMinutes = Math.max(0, Math.ceil(remainingMs / 60_000))
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours > 0) {
    return `${hours} ч ${String(minutes).padStart(2, "0")} мин`
  }
  return formatCountdown(remainingMs)
}

export function getFlashSaleState(
  settings: Settings,
  now = Date.now(),
  durationMs = settings.flashSaleDurationMs ?? FLASH_SALE_DURATION_MS,
) {
  if (isUserSubscribed(settings)) {
    return { active: false as const }
  }

  const promotion = getPaywallPromotion(settings.paywallPromotionId)
  if (promotion && isPromotionActive(promotion, now)) {
    const remainingMs = getPromotionRemainingMs(promotion, now)
    if (remainingMs > 0) {
      return {
        active: true as const,
        remainingMs,
        countdownLabel: formatPromotionCountdown(remainingMs),
        promotionId: promotion.id,
        promotionTitle: promotion.bannerTitle,
        promotionBadgeLabel: promotion.badgeLabel,
      }
    }
    return { active: false as const, expired: true as const }
  }

  if (!settings.paywallFlashSaleStartedAt) {
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

export function hasFreemiumTrialCompleted(settings: Settings) {
  return settings.homeWalkthroughCompleted && settings.firstExpenseAdded
}

export function canActivatePaywall(settings: Settings) {
  return hasFreemiumTrialCompleted(settings) && !isUserSubscribed(settings)
}

export function shouldStartFlashSaleTimer(settings: Settings, transactions: Transaction[]) {
  if (isUserSubscribed(settings) || settings.paywallFlashSaleStartedAt) {
    return false
  }

  return settings.firstExpenseAdded || hasSavedExpense(transactions)
}

export function resolvePaywallAccess(settings: Settings): {
  isContentLocked: boolean
  requiresPremiumAfterWalkthrough: boolean
} {
  const subscribed = isUserSubscribed(settings)
  const paywallActive =
    settings.paywallShown && !subscribed && hasFreemiumTrialCompleted(settings)

  return {
    isContentLocked: paywallActive,
    requiresPremiumAfterWalkthrough: paywallActive,
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
