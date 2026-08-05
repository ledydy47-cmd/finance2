import type { Settings } from "@/lib/types"
import { isSubscriptionActive } from "@/lib/subscription"

export function clearPaywallOfferSettings(settings: Settings): Settings {
  return {
    ...settings,
    paywallFlashSaleStartedAt: null,
    flashSaleDurationMs: null,
  }
}

export function mergeActiveSubscriptionSettings(
  settings: Settings,
  patch: Partial<Settings>,
): Settings {
  const merged = { ...settings, ...patch }
  const subscribed =
    Boolean(patch.isSubscribed) || isSubscriptionActive(patch.subscriptionExpiresAt ?? merged.subscriptionExpiresAt)

  if (!subscribed) return merged
  return clearPaywallOfferSettings(merged)
}

export async function fetchServerSubscriptionSettings(
  userKey: string,
): Promise<Partial<Settings> | null> {
  try {
    const response = await fetch(
      `/api/subscription/status?userKey=${encodeURIComponent(userKey)}`,
      { cache: "no-store" },
    )
    const payload = (await response.json()) as {
      subscription?: {
        active?: boolean
        subscriptionType?: Settings["subscriptionPlan"]
        currentPeriodEnd?: string
        autoRenew?: boolean
        status?: Settings["subscriptionStatus"]
        lastPaymentId?: string | null
      } | null
    }

    const subscription = payload.subscription
    if (!subscription) return null

    return {
      isSubscribed: Boolean(subscription.active),
      subscriptionPlan: subscription.subscriptionType ?? null,
      subscriptionExpiresAt: subscription.currentPeriodEnd ?? null,
      autoRenew: subscription.autoRenew ?? true,
      subscriptionStatus: subscription.status,
      ...(subscription.lastPaymentId ? { lastPaymentId: subscription.lastPaymentId } : {}),
    }
  } catch {
    return null
  }
}

export async function fetchServerFlashSaleStatus(userKey: string) {
  try {
    const response = await fetch(
      `/api/subscription/flash-sale-status?userKey=${encodeURIComponent(userKey)}`,
      { cache: "no-store" },
    )
    const payload = (await response.json()) as {
      active?: boolean
      startedAt?: string
      saleDurationMs?: number
      remainingMs?: number
      subscribed?: boolean
    }

    if (!response.ok || !payload.active || !payload.startedAt || !payload.saleDurationMs) {
      return null
    }

    return {
      startedAt: payload.startedAt,
      saleDurationMs: payload.saleDurationMs,
      remainingMs: payload.remainingMs ?? 0,
    }
  } catch {
    return null
  }
}
