import { getServerSubscriptionStatus } from "@/lib/server/subscription-service"
import {
  getFlashSaleStartedAt,
  resolveFlashSaleStartedAt,
} from "@/lib/server/flash-sale-store"
import { getFlashSaleLifecycle } from "@/lib/server/flash-sale-lifecycle-store"
import { getFlashSaleTiming } from "@/lib/server/flash-sale-timing"
import {
  getPaymentAmountForPlan,
  resolvePaywallPricingPhase,
  type PaywallPricingPhase,
} from "@/lib/paywall-pricing"
import { getPaywallPromotion, isPromotionActive } from "@/lib/paywall-promotions"
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

async function resolvePromotionId(userKey: string, clientPromotionId?: string | null) {
  if (clientPromotionId?.trim()) {
    return clientPromotionId.trim()
  }
  const lifecycle = await getFlashSaleLifecycle(userKey)
  return lifecycle?.promotionId ?? lifecycle?.pendingPromotionId ?? null
}

export async function resolveServerPaywallPricing(input: {
  userKey: string
  plan: SubscriptionPlan
  now?: number
  paywallFlashSaleStartedAt?: string | null
  flashSaleDurationMs?: number | null
  paywallPromotionId?: string | null
}) {
  const subscription = await getServerSubscriptionStatus(input.userKey)
  if (subscription?.active) {
    return {
      phase: "standard" as PaywallPricingPhase,
      amount: getPaymentAmountForPlan({
        plan: input.plan,
        phase: "standard",
        now: input.now,
      }),
    }
  }

  const now = input.now ?? Date.now()
  const promotionId = await resolvePromotionId(input.userKey, input.paywallPromotionId)
  const promotion = getPaywallPromotion(promotionId)

  if (promotion && isPromotionActive(promotion, now)) {
    return {
      phase: "flash_sale" as PaywallPricingPhase,
      amount: getPaymentAmountForPlan({
        plan: input.plan,
        phase: "flash_sale",
        promotionId: promotion.id,
        now,
      }),
      promotionId: promotion.id,
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
    paywallPromotionId: promotionId,
    now,
  })

  return {
    phase,
    amount: getPaymentAmountForPlan({
      plan: input.plan,
      phase,
      promotionId,
      now,
    }),
  }
}
