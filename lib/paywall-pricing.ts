import { PLAN_CONFIG, type SubscriptionPlan } from "@/lib/subscription"
import type { Settings } from "@/lib/types"
import {
  FLASH_SALE_DURATION_MS,
  FLASH_SALE_LIST_PRICES,
  FLASH_SALE_SALE_PRICES,
  isUserSubscribed,
} from "@/lib/paywall-experiment"

export type PaywallPricingPhase = "standard" | "flash_sale" | "full_price"

export const FULL_PRICE_AMOUNTS: Record<SubscriptionPlan, string> = {
  yearly: "2980.00",
  monthly: "598.00",
}

export function resolvePaywallPricingPhase(input: {
  paywallFlashSaleStartedAt?: string | null
  isSubscribed?: boolean
  now?: number
}): PaywallPricingPhase {
  if (input.isSubscribed || !input.paywallFlashSaleStartedAt) {
    return "standard"
  }

  const startedAt = new Date(input.paywallFlashSaleStartedAt).getTime()
  if (Number.isNaN(startedAt)) {
    return "standard"
  }

  const now = input.now ?? Date.now()
  const remainingMs = FLASH_SALE_DURATION_MS - (now - startedAt)
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

export interface PaywallPlanDisplayPrices {
  total?: number
  perMonth: number
  listTotal?: number
  listPerMonth?: number
  showDiscount: boolean
}

export function getPaywallDisplayPrices(input: {
  settings: Settings
  now?: number
}): {
  phase: PaywallPricingPhase
  yearly: PaywallPlanDisplayPrices
  monthly: PaywallPlanDisplayPrices
} {
  const isSubscribed = isUserSubscribed(input.settings)
  const phase = resolvePaywallPricingPhase({
    paywallFlashSaleStartedAt: input.settings.paywallFlashSaleStartedAt,
    isSubscribed,
    now: input.now,
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
