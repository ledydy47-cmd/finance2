import {
  computeSubscriptionExpiry,
  isSubscriptionActive,
  PLAN_CONFIG,
  type SubscriptionPlan,
} from "@/lib/subscription"
import type { YooKassaPayment } from "@/lib/yookassa/server"
import { fetchYooKassaPayment } from "@/lib/yookassa/server"

export interface VerifiedSubscription {
  paymentId: string
  plan: SubscriptionPlan
  expiresAt: string
  active: boolean
}

export async function verifyYooKassaSubscription(
  paymentId: string,
): Promise<VerifiedSubscription | null> {
  const payment = await fetchYooKassaPayment(paymentId)
  return mapPaymentToSubscription(payment)
}

export function mapPaymentToSubscription(payment: YooKassaPayment): VerifiedSubscription | null {
  if (payment.status !== "succeeded" || !payment.paid) return null

  const plan = payment.metadata?.plan
  if (plan !== "yearly" && plan !== "monthly") return null

  const expiresAt = computeSubscriptionExpiry(plan)
  return {
    paymentId: payment.id,
    plan,
    expiresAt,
    active: isSubscriptionActive(expiresAt),
  }
}

export function getPlanConfig(plan: SubscriptionPlan) {
  return PLAN_CONFIG[plan]
}
