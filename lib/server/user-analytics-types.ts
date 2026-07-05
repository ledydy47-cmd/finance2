import type { SubscriptionPlan } from "@/lib/subscription"

export type AnalyticsEventType =
  | "app_opened"
  | "onboarding_started"
  | "onboarding_completed"
  | "walkthrough_completed"
  | "paywall_shown"
  | "subscription_paid_monthly"
  | "subscription_paid_yearly"
  | "auto_renew_canceled"

export type UserSubscriptionFilter = "none" | "monthly" | "yearly"

export interface AnalyticsEvent {
  type: AnalyticsEventType
  at: string
}

export interface UserAnalyticsRecord {
  userKey: string
  telegramUserId: number | null
  telegramUsername: string | null
  userName: string | null
  age: number | null
  appOpenedAt: string | null
  onboardingStartedAt: string | null
  onboardingCompletedAt: string | null
  walkthroughCompletedAt: string | null
  paywallShownAt: string | null
  subscribedMonthlyAt: string | null
  subscribedYearlyAt: string | null
  autoRenewCanceledAt: string | null
  subscriptionPlan: UserSubscriptionFilter
  lastVisitAt: string
  events: AnalyticsEvent[]
}

export interface UserAnalyticsStoreSnapshot {
  users: Record<string, UserAnalyticsRecord>
}

export type MessageCampaignFilter =
  | "all"
  | "no_subscription"
  | "monthly"
  | "yearly"
  | "paywall_no_pay"

export type MessageCampaignType = "scheduled_broadcast" | "delayed_filter" | "scheduled_user"

export interface MessageCampaign {
  id: string
  name: string
  message: string
  type: MessageCampaignType
  filter: MessageCampaignFilter
  scheduledAt: string | null
  delayHours: number | null
  targetUserKey: string | null
  triggerEvent: "paywall_shown" | null
  status: "active" | "paused" | "completed"
  sentToUserKeys: string[]
  createdAt: string
  lastRunAt: string | null
}

export interface MessageCampaignStoreSnapshot {
  campaigns: Record<string, MessageCampaign>
}

export function planToFilter(plan?: SubscriptionPlan | null): UserSubscriptionFilter {
  if (plan === "monthly") return "monthly"
  if (plan === "yearly") return "yearly"
  return "none"
}
