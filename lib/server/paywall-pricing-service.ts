import { getServerSubscriptionStatus } from "@/lib/server/subscription-service"
import {
  getFlashSaleStartedAt,
  resolveFlashSaleStartedAt,
} from "@/lib/server/flash-sale-store"
import { getFlashSaleTiming } from "@/lib/server/flash-sale-timing"
import {
  getPaymentAmountForPhase,
  resolvePaywallPricingPhase,
  type PaywallPricingPhase,
} from "@/lib/paywall-pricing"
import { FLASH_SALE_DURATION_MS } from "@/lib/paywall-experiment"
import type { SubscriptionPlan } from "@/lib/subscription"

function parseClientStartedAt(value?: string | null) {
  const trimmed = value?.trim()
  if (!trimmed) return null

  const startedMs = new Date(trimmed).getTime()
  if (Number.isNaN(startedMs)) return null
  if (startedMs > Date.now() + 60_000) return null

  return trimmed
}

export async function resolveServerPaywallPricing(input: {
  userKey: string
  plan: SubscriptionPlan
  now?: number
  paywallFlashSaleStartedAt?: string | null
  flashSaleDurationMs?: number | null
}) {
  const subscription = await getServerSubscriptionStatus(input.userKey)
  if (subscription?.active) {
    return {
      phase: "standard" as PaywallPricingPhase,
      amount: getPaymentAmountForPhase(input.plan, "standard"),
    }
  }

  let startedAt = await getFlashSaleStartedAt(input.userKey)
  const clientStartedAt = parseClientStartedAt(input.paywallFlashSaleStartedAt)
  if (!startedAt && clientStartedAt) {
    startedAt = await resolveFlashSaleStartedAt(input.userKey, clientStartedAt)
  }

  const timing = startedAt ? await getFlashSaleTiming(input.userKey, startedAt) : null
  const phase = resolvePaywallPricingPhase({
    paywallFlashSaleStartedAt: startedAt,
    flashSaleDurationMs:
      timing?.saleDurationMs ?? input.flashSaleDurationMs ?? FLASH_SALE_DURATION_MS,
    now: input.now,
  })

  return {
    phase,
    amount: getPaymentAmountForPhase(input.plan, phase),
  }
}
