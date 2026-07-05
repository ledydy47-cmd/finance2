import type { SubscriptionPlan } from "@/lib/subscription"

export type SubscriptionStatus = "active" | "canceled" | "expired" | "past_due"

export interface SubscriptionRecord {
  userKey: string
  telegramUserId: number | null
  paymentMethodId: string | null
  subscriptionType: SubscriptionPlan
  currentPeriodEnd: string
  autoRenew: boolean
  status: SubscriptionStatus
  renewalAttempts: number
  lastPaymentId: string | null
  updatedAt: string
}

export interface SubscriptionStoreSnapshot {
  records: Record<string, SubscriptionRecord>
}
