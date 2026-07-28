import { getServerSubscriptionStatus } from "@/lib/server/subscription-service"
import { getFlashSaleStartedAt } from "@/lib/server/flash-sale-store"
import { getFlashSaleTiming } from "@/lib/server/flash-sale-timing"
import {
  getPaymentAmountForPhase,
  resolvePaywallPricingPhase,
  type PaywallPricingPhase,
} from "@/lib/paywall-pricing"
import type { SubscriptionPlan } from "@/lib/subscription"

export async function resolveServerPaywallPricing(input: {
  userKey: string
  plan: SubscriptionPlan
  now?: number
}) {
  const subscription = await getServerSubscriptionStatus(input.userKey)
  if (subscription?.active) {
    return {
      phase: "standard" as PaywallPricingPhase,
      amount: getPaymentAmountForPhase(input.plan, "standard"),
    }
  }

  const startedAtFromKv = await getFlashSaleStartedAt(input.userKey)
  const timing = startedAtFromKv
    ? await getFlashSaleTiming(input.userKey, startedAtFromKv)
    : null
  const phase = resolvePaywallPricingPhase({
    paywallFlashSaleStartedAt: startedAtFromKv,
    flashSaleDurationMs: timing?.saleDurationMs,
    now: input.now,
  })

  return {
    phase,
    amount: getPaymentAmountForPhase(input.plan, phase),
  }
}
