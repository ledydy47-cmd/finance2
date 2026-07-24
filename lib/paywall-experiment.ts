import type { Settings } from "@/lib/types"

const DEFAULT_ONE_FREE_EXPENSE_USER_IDS = "664811251"

function parseTestUserIds(raw: string | undefined) {
  return new Set(
    (raw ?? DEFAULT_ONE_FREE_EXPENSE_USER_IDS)
      .split(",")
      .map((item) => Number(item.trim()))
      .filter(Number.isFinite),
  )
}

function isUserSubscribed(settings: Settings) {
  if (settings.isSubscribed) return true
  if (settings.subscriptionExpiresAt) {
    return new Date(settings.subscriptionExpiresAt).getTime() > Date.now()
  }
  return false
}

export function isOneFreeExpenseTestUser(telegramUserId?: number | null) {
  if (!telegramUserId) return false
  const ids = parseTestUserIds(process.env.NEXT_PUBLIC_ONE_FREE_EXPENSE_USER_IDS)
  return ids.has(telegramUserId)
}

export function resolvePaywallAccess(
  settings: Settings,
  telegramUserId?: number | null,
): {
  isContentLocked: boolean
  requiresPremiumAfterWalkthrough: boolean
  showPaywallOnFirstExpense: boolean
} {
  const subscribed = isUserSubscribed(settings)

  if (isOneFreeExpenseTestUser(telegramUserId)) {
    const usedFreeExpense = settings.firstExpenseAdded
    return {
      isContentLocked: usedFreeExpense && !subscribed,
      requiresPremiumAfterWalkthrough:
        settings.homeWalkthroughCompleted && usedFreeExpense && !subscribed,
      showPaywallOnFirstExpense: false,
    }
  }

  return {
    isContentLocked: settings.paywallShown && !subscribed,
    requiresPremiumAfterWalkthrough:
      settings.homeWalkthroughCompleted && !subscribed,
    showPaywallOnFirstExpense: true,
  }
}
