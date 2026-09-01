import { PLAN_CONFIG, type SubscriptionPlan } from "@/lib/subscription"
import type { Settings } from "@/lib/types"
import {
  FLASH_SALE_DURATION_MS,
  FLASH_SALE_LIST_PRICES,
  FLASH_SALE_SALE_PRICES,
  isUserSubscribed,
} from "@/lib/paywall-experiment"
import {
  getPaywallPromotion,
  getPromotionPlanAmount,
  getPromotionYearlyPerMonth,
  isPromotionActive,
} from "@/lib/paywall-promotions"

export type PaywallPricingPhase = "standard" | "flash_sale" | "full_price"

export const FULL_PRICE_AMOUNTS: Record<SubscriptionPlan, string> = {
  yearly: "2980.00",
  monthly: "598.00",
}

export function resolvePaywallPricingPhase(input: {
  paywallFlashSaleStartedAt?: string | null
  flashSaleDurationMs?: number | null
  paywallPromotionId?: string | null
  isSubscribed?: boolean
  now?: number
}): PaywallPricingPhase {
  if (input.isSubscribed) {
    return "standard"
  }

  const now = input.now ?? Date.now()
  const promotion = getPaywallPromotion(input.paywallPromotionId)
  if (promotion && isPromotionActive(promotion, now)) {
    return "flash_sale"
  }

  if (!input.paywallFlashSaleStartedAt) {
    return "standard"
  }

  const startedAt = new Date(input.paywallFlashSaleStartedAt).getTime()
  if (Number.isNaN(startedAt)) {
    return "standard"
  }

  const durationMs = input.flashSaleDurationMs ?? FLASH_SALE_DURATION_MS
  const remainingMs = durationMs - (now - startedAt)
  if (remainingMs > 0) {
    return "flash_sale"
  }

  return "full_price"
}

export function getPaymentAmountForPhase(plan: SubscriptionPlan, phase: PaywallPricingPhase) {
  if (phase === "full_price") {
    return FULL_PRICE_AMOUNTS[plan]
  }
  return PLAN_CONFIG[plan].amount
}

export function getPaymentAmountForPlan(input: {
  plan: SubscriptionPlan
  phase: PaywallPricingPhase
  promotionId?: string | null
  now?: number
}) {
  const promotion = getPaywallPromotion(input.promotionId)
  if (
    promotion &&
    isPromotionActive(promotion, input.now) &&
    input.phase === "flash_sale"
  ) {
    return getPromotionPlanAmount(input.plan, promotion)
  }
  return getPaymentAmountForPhase(input.plan, input.phase)
}

export interface PaywallPlanDisplayPrices {
  total?: number
  perMonth: number
  listTotal?: number
  listPerMonth?: number
  showDiscount: boolean
}

function getPromotionDisplayPrices(promotion: NonNullable<ReturnType<typeof getPaywallPromotion>>) {
  return {
    phase: "flash_sale" as const,
    yearly: {
      total: Number(promotion.yearlyAmount),
      perMonth: getPromotionYearlyPerMonth(promotion),
      listTotal: promotion.yearlyListTotal,
      listPerMonth: FLASH_SALE_LIST_PRICES.yearly.perMonth,
      showDiscount: true,
    },
    monthly: {
      perMonth: Number(promotion.monthlyAmount),
      showDiscount: false,
    },
  }
}

export function getPaywallDisplayPrices(input: {
  settings: Settings
  now?: number
}): {
  phase: PaywallPricingPhase
  yearly: PaywallPlanDisplayPrices
  monthly: PaywallPlanDisplayPrices
  promotionId?: string | null
} {
  const isSubscribed = isUserSubscribed(input.settings)
  const now = input.now ?? Date.now()
  const promotion = getPaywallPromotion(input.settings.paywallPromotionId)

  if (promotion && isPromotionActive(promotion, now) && !isSubscribed) {
    return {
      ...getPromotionDisplayPrices(promotion),
      promotionId: promotion.id,
    }
  }

  const phase = resolvePaywallPricingPhase({
    paywallFlashSaleStartedAt: input.settings.paywallFlashSaleStartedAt,
    flashSaleDurationMs: input.settings.flashSaleDurationMs,
    paywallPromotionId: input.settings.paywallPromotionId,
    isSubscribed,
    now,
  })

  if (phase === "flash_sale") {
    return {
      phase,
      yearly: {
        total: FLASH_SALE_SALE_PRICES.yearly.total,
        perMonth: FLASH_SALE_SALE_PRICES.yearly.perMonth,
        listTotal: FLASH_SALE_LIST_PRICES.yearly.total,
        listPerMonth: FLASH_SALE_LIST_PRICES.yearly.perMonth,
        showDiscount: true,
      },
      monthly: {
        perMonth: FLASH_SALE_SALE_PRICES.monthly.perMonth,
        listPerMonth: FLASH_SALE_LIST_PRICES.monthly.perMonth,
        showDiscount: true,
      },
    }
  }

  if (phase === "full_price") {
    return {
      phase,
      yearly: {
        total: FLASH_SALE_LIST_PRICES.yearly.total,
        perMonth: FLASH_SALE_LIST_PRICES.yearly.perMonth,
        showDiscount: false,
      },
      monthly: {
        perMonth: FLASH_SALE_LIST_PRICES.monthly.perMonth,
        showDiscount: false,
      },
    }
  }

  return {
    phase,
    yearly: {
      total: FLASH_SALE_SALE_PRICES.yearly.total,
      perMonth: FLASH_SALE_SALE_PRICES.yearly.perMonth,
      showDiscount: false,
    },
    monthly: {
      perMonth: FLASH_SALE_SALE_PRICES.monthly.perMonth,
      showDiscount: false,
    },
  }
}
