import type { FlashSaleLifecycle } from "@/lib/server/flash-sale-lifecycle-store"
import type { FlashSaleTestSession } from "@/lib/server/flash-sale-test-mode"
import type { PendingPaymentRecord } from "@/lib/server/pending-payment-store"
import type { SubscriptionRecord } from "@/lib/server/subscription-types"
import type { SupportTicket } from "@/lib/server/support-types"
import type { TelegramUserRecord } from "@/lib/server/telegram-users"
import type {
  AnalyticsEvent,
  MessageCampaign,
  UserAnalyticsRecord,
  UserSubscriptionFilter,
} from "@/lib/server/user-analytics-types"
import type {
  flashSaleLifecycle as flashSaleLifecycleTable,
  flashSaleReminders as flashSaleRemindersTable,
  flashSaleTestSessions as flashSaleTestSessionsTable,
  messageCampaigns as messageCampaignsTable,
  pendingPayments as pendingPaymentsTable,
  subscriptions as subscriptionsTable,
  supportTickets as supportTicketsTable,
  telegramUsers as telegramUsersTable,
  userAnalytics as userAnalyticsTable,
} from "@/lib/db/schema"

type UserAnalyticsRow = typeof userAnalyticsTable.$inferSelect
type UserAnalyticsInsert = typeof userAnalyticsTable.$inferInsert
type SubscriptionRow = typeof subscriptionsTable.$inferSelect
type TelegramUserRow = typeof telegramUsersTable.$inferSelect
type SupportTicketRow = typeof supportTicketsTable.$inferSelect
type PendingPaymentRow = typeof pendingPaymentsTable.$inferSelect
type FlashSaleReminderRow = typeof flashSaleRemindersTable.$inferSelect
type FlashSaleLifecycleRow = typeof flashSaleLifecycleTable.$inferSelect
type FlashSaleTestSessionRow = typeof flashSaleTestSessionsTable.$inferSelect
type MessageCampaignRow = typeof messageCampaignsTable.$inferSelect

export function userAnalyticsToRecord(row: UserAnalyticsRow): UserAnalyticsRecord {
  let events: AnalyticsEvent[] = []
  try {
    events = JSON.parse(row.eventsJson) as AnalyticsEvent[]
  } catch {
    events = []
  }

  return {
    userKey: row.userKey,
    telegramUserId: row.telegramUserId,
    telegramUsername: row.telegramUsername,
    userName: row.userName,
    age: row.age,
    appOpenedAt: row.appOpenedAt,
    onboardingStartedAt: row.onboardingStartedAt,
    onboardingReoffer1hScheduledAt: row.onboardingReoffer1hScheduledAt,
    onboardingReoffer1hSentAt: row.onboardingReoffer1hSentAt,
    onboardingCompletedAt: row.onboardingCompletedAt,
    walkthroughCompletedAt: row.walkthroughCompletedAt,
    homeWalkthroughCompleted: row.homeWalkthroughCompleted,
    firstExpenseAdded: row.firstExpenseAdded,
    paywallShownAt: row.paywallShownAt,
    subscribedMonthlyAt: row.subscribedMonthlyAt,
    subscribedYearlyAt: row.subscribedYearlyAt,
    autoRenewCanceledAt: row.autoRenewCanceledAt,
    subscriptionPlan: row.subscriptionPlan as UserSubscriptionFilter,
    lastVisitAt: row.lastVisitAt,
    events,
  }
}

export function userAnalyticsToRow(record: UserAnalyticsRecord): UserAnalyticsInsert {
  return {
    userKey: record.userKey,
    telegramUserId: record.telegramUserId,
    telegramUsername: record.telegramUsername,
    userName: record.userName,
    age: record.age,
    appOpenedAt: record.appOpenedAt,
    onboardingStartedAt: record.onboardingStartedAt,
    onboardingReoffer1hScheduledAt: record.onboardingReoffer1hScheduledAt,
    onboardingReoffer1hSentAt: record.onboardingReoffer1hSentAt,
    onboardingCompletedAt: record.onboardingCompletedAt,
    walkthroughCompletedAt: record.walkthroughCompletedAt,
    homeWalkthroughCompleted: record.homeWalkthroughCompleted,
    firstExpenseAdded: record.firstExpenseAdded,
    paywallShownAt: record.paywallShownAt,
    subscribedMonthlyAt: record.subscribedMonthlyAt,
    subscribedYearlyAt: record.subscribedYearlyAt,
    autoRenewCanceledAt: record.autoRenewCanceledAt,
    subscriptionPlan: record.subscriptionPlan,
    lastVisitAt: record.lastVisitAt,
    eventsJson: JSON.stringify(record.events),
  }
}

export function subscriptionToRecord(row: SubscriptionRow): SubscriptionRecord {
  return {
    userKey: row.userKey,
    telegramUserId: row.telegramUserId,
    paymentMethodId: row.paymentMethodId,
    subscriptionType: row.subscriptionType as SubscriptionRecord["subscriptionType"],
    currentPeriodEnd: row.currentPeriodEnd,
    autoRenew: row.autoRenew,
    status: row.status as SubscriptionRecord["status"],
    renewalAttempts: row.renewalAttempts,
    lastPaymentId: row.lastPaymentId,
    updatedAt: row.updatedAt,
  }
}

export function subscriptionToRow(record: SubscriptionRecord) {
  return {
    userKey: record.userKey,
    telegramUserId: record.telegramUserId,
    paymentMethodId: record.paymentMethodId,
    subscriptionType: record.subscriptionType,
    currentPeriodEnd: record.currentPeriodEnd,
    autoRenew: record.autoRenew,
    status: record.status,
    renewalAttempts: record.renewalAttempts,
    lastPaymentId: record.lastPaymentId,
    updatedAt: record.updatedAt,
  }
}

export function telegramUserToRecord(row: TelegramUserRow): TelegramUserRecord {
  return {
    userKey: row.userKey,
    telegramUserId: row.telegramUserId,
    username: row.username,
    firstName: row.firstName,
    updatedAt: row.updatedAt,
  }
}

export function supportTicketToRecord(row: SupportTicketRow): SupportTicket {
  return {
    id: row.id,
    userKey: row.userKey,
    telegramUserId: row.telegramUserId,
    telegramUsername: row.telegramUsername,
    userName: row.userName,
    message: row.message,
    status: row.status as SupportTicket["status"],
    reply: row.reply,
    createdAt: row.createdAt,
    repliedAt: row.repliedAt,
  }
}

export function supportTicketToRow(ticket: SupportTicket) {
  return {
    id: ticket.id,
    userKey: ticket.userKey,
    telegramUserId: ticket.telegramUserId,
    telegramUsername: ticket.telegramUsername,
    userName: ticket.userName,
    message: ticket.message,
    status: ticket.status,
    reply: ticket.reply,
    createdAt: ticket.createdAt,
    repliedAt: ticket.repliedAt,
  }
}

export function pendingPaymentToRecord(row: PendingPaymentRow): PendingPaymentRecord {
  return {
    userKey: row.userKey,
    paymentId: row.paymentId,
    orderId: row.orderId,
    plan: row.plan as PendingPaymentRecord["plan"],
    createdAt: row.createdAt,
  }
}

export function flashSaleReminderFromRow(row: FlashSaleReminderRow) {
  return {
    userKey: row.userKey,
    startedAt: row.startedAt,
    remindAt: row.remindAt,
    sent: row.sent,
  }
}

export function flashSaleLifecycleToRecord(row: FlashSaleLifecycleRow): FlashSaleLifecycle {
  return {
    userKey: row.userKey,
    startedAt: row.startedAt,
    expiredAt: row.expiredAt,
    pendingOffer: row.pendingOffer as FlashSaleLifecycle["pendingOffer"],
    offer4hSentAt: row.offer4hSentAt,
    offer24hSentAt: row.offer24hSentAt,
  }
}

export function flashSaleLifecycleToRow(lifecycle: FlashSaleLifecycle) {
  return {
    userKey: lifecycle.userKey,
    startedAt: lifecycle.startedAt,
    expiredAt: lifecycle.expiredAt,
    pendingOffer: lifecycle.pendingOffer,
    offer4hSentAt: lifecycle.offer4hSentAt,
    offer24hSentAt: lifecycle.offer24hSentAt,
  }
}

export function flashSaleTestSessionToRecord(row: FlashSaleTestSessionRow): FlashSaleTestSession {
  return {
    userKey: row.userKey,
    startedAt: row.startedAt,
    saleDurationMs: row.saleDurationMs,
    reminderDelayMs: row.reminderDelayMs,
    reoffer4hMs: row.reoffer4hMs,
    reoffer24hMs: row.reoffer24hMs,
    createdAt: row.createdAt,
  }
}

export function messageCampaignToRecord(row: MessageCampaignRow): MessageCampaign {
  let sentToUserKeys: string[] = []
  try {
    sentToUserKeys = JSON.parse(row.sentToUserKeysJson) as string[]
  } catch {
    sentToUserKeys = []
  }

  return {
    id: row.id,
    name: row.name,
    message: row.message,
    type: row.type as MessageCampaign["type"],
    filter: row.filter as MessageCampaign["filter"],
    scheduledAt: row.scheduledAt,
    delayHours: row.delayHours,
    targetUserKey: row.targetUserKey,
    triggerEvent: row.triggerEvent as MessageCampaign["triggerEvent"],
    status: row.status as MessageCampaign["status"],
    sentToUserKeys,
    createdAt: row.createdAt,
    lastRunAt: row.lastRunAt,
  }
}

export function messageCampaignToRow(campaign: MessageCampaign) {
  return {
    id: campaign.id,
    name: campaign.name,
    message: campaign.message,
    type: campaign.type,
    filter: campaign.filter,
    scheduledAt: campaign.scheduledAt,
    delayHours: campaign.delayHours,
    targetUserKey: campaign.targetUserKey,
    triggerEvent: campaign.triggerEvent,
    status: campaign.status,
    sentToUserKeysJson: JSON.stringify(campaign.sentToUserKeys),
    createdAt: campaign.createdAt,
    lastRunAt: campaign.lastRunAt,
  }
}
