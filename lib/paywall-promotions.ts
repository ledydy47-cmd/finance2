import type { SubscriptionPlan } from "@/lib/subscription"

export interface PaywallPromotion {
  id: string
  endsAt: string
  yearlyAmount: string
  yearlyListTotal: number
  monthlyAmount: string
  badgeLabel: string
  bannerTitle: string
  /** When set, promotion uses fixed end time instead of flash-sale duration timer. */
  fixedEndsAt?: boolean
}

export const SEPT1_2026_PROMO: PaywallPromotion = {
  id: "sept1_2026",
  endsAt: "2026-09-01T20:59:59.999Z",
  yearlyAmount: "999.00",
  yearlyListTotal: 2980,
  monthlyAmount: "598.00",
  badgeLabel: "−67%",
  bannerTitle: "1 сентября — суперскидка на год",
  fixedEndsAt: true,
}

export const PAYWALL_PROMOTIONS: Record<string, PaywallPromotion> = {
  [SEPT1_2026_PROMO.id]: SEPT1_2026_PROMO,
}

export function getPaywallPromotion(promotionId?: string | null) {
  if (!promotionId?.trim()) return null
  return PAYWALL_PROMOTIONS[promotionId.trim()] ?? null
}

export function isPromotionActive(promotion: PaywallPromotion, now = Date.now()) {
  const endsAtMs = new Date(promotion.endsAt).getTime()
  if (Number.isNaN(endsAtMs)) return false
  return now < endsAtMs
}

export function getPromotionRemainingMs(promotion: PaywallPromotion, now = Date.now()) {
  const endsAtMs = new Date(promotion.endsAt).getTime()
  if (Number.isNaN(endsAtMs)) return 0
  return Math.max(0, endsAtMs - now)
}

export function getPromotionPlanAmount(plan: SubscriptionPlan, promotion: PaywallPromotion) {
  return plan === "yearly" ? promotion.yearlyAmount : promotion.monthlyAmount
}

export function getPromotionYearlyPerMonth(promotion: PaywallPromotion) {
  return Math.round(Number(promotion.yearlyAmount) / 12)
}

export const SEPT1_BROADCAST_MESSAGE =
  "1 сентября — суперскидка! Годовая подписка всего 999 ₽ вместо 2980 ₽. Открой приложение сегодня и успей 💗"
