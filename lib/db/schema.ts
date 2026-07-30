import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core"

export const userAnalytics = sqliteTable(
  "user_analytics",
  {
    userKey: text("user_key").primaryKey(),
    telegramUserId: integer("telegram_user_id"),
    telegramUsername: text("telegram_username"),
    userName: text("user_name"),
    age: integer("age"),
    appOpenedAt: text("app_opened_at"),
    onboardingStartedAt: text("onboarding_started_at"),
    onboardingReoffer1hScheduledAt: text("onboarding_reoffer_1h_scheduled_at"),
    onboardingReoffer1hSentAt: text("onboarding_reoffer_1h_sent_at"),
    onboardingCompletedAt: text("onboarding_completed_at"),
    walkthroughCompletedAt: text("walkthrough_completed_at"),
    homeWalkthroughCompleted: integer("home_walkthrough_completed", { mode: "boolean" }),
    firstExpenseAdded: integer("first_expense_added", { mode: "boolean" }),
    paywallShownAt: text("paywall_shown_at"),
    subscribedMonthlyAt: text("subscribed_monthly_at"),
    subscribedYearlyAt: text("subscribed_yearly_at"),
    autoRenewCanceledAt: text("auto_renew_canceled_at"),
    subscriptionPlan: text("subscription_plan").notNull().default("none"),
    lastVisitAt: text("last_visit_at").notNull(),
    eventsJson: text("events_json").notNull().default("[]"),
  },
  (table) => [index("user_analytics_last_visit_idx").on(table.lastVisitAt)],
)

export const subscriptions = sqliteTable("subscriptions", {
  userKey: text("user_key").primaryKey(),
  telegramUserId: integer("telegram_user_id"),
  paymentMethodId: text("payment_method_id"),
  subscriptionType: text("subscription_type").notNull(),
  currentPeriodEnd: text("current_period_end").notNull(),
  autoRenew: integer("auto_renew", { mode: "boolean" }).notNull(),
  status: text("status").notNull(),
  renewalAttempts: integer("renewal_attempts").notNull().default(0),
  lastPaymentId: text("last_payment_id"),
  updatedAt: text("updated_at").notNull(),
})

export const telegramUsers = sqliteTable(
  "telegram_users",
  {
    userKey: text("user_key").primaryKey(),
    telegramUserId: integer("telegram_user_id").notNull(),
    username: text("username"),
    firstName: text("first_name"),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [uniqueIndex("telegram_users_username_idx").on(table.username)],
)

export const supportTickets = sqliteTable(
  "support_tickets",
  {
    id: text("id").primaryKey(),
    userKey: text("user_key").notNull(),
    telegramUserId: integer("telegram_user_id"),
    telegramUsername: text("telegram_username"),
    userName: text("user_name"),
    message: text("message").notNull(),
    status: text("status").notNull(),
    reply: text("reply"),
    createdAt: text("created_at").notNull(),
    repliedAt: text("replied_at"),
  },
  (table) => [index("support_tickets_created_idx").on(table.createdAt)],
)

export const pendingPayments = sqliteTable(
  "pending_payments",
  {
    userKey: text("user_key").primaryKey(),
    paymentId: text("payment_id").notNull(),
    orderId: text("order_id").notNull(),
    plan: text("plan").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    uniqueIndex("pending_payments_order_idx").on(table.orderId),
    uniqueIndex("pending_payments_payment_idx").on(table.paymentId),
  ],
)

export const flashSales = sqliteTable("flash_sales", {
  userKey: text("user_key").primaryKey(),
  startedAt: text("started_at").notNull(),
})

export const flashSaleReminders = sqliteTable(
  "flash_sale_reminders",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userKey: text("user_key").notNull(),
    startedAt: text("started_at").notNull(),
    remindAt: text("remind_at").notNull(),
    sent: integer("sent", { mode: "boolean" }).notNull().default(false),
  },
  (table) => [index("flash_sale_reminders_due_idx").on(table.remindAt, table.sent)],
)

export const flashSaleLifecycle = sqliteTable("flash_sale_lifecycle", {
  userKey: text("user_key").primaryKey(),
  startedAt: text("started_at").notNull(),
  expiredAt: text("expired_at"),
  pendingOffer: text("pending_offer"),
  offer4hSentAt: text("offer_4h_sent_at"),
  offer24hSentAt: text("offer_24h_sent_at"),
})

export const flashSaleTestSessions = sqliteTable("flash_sale_test_sessions", {
  userKey: text("user_key").primaryKey(),
  startedAt: text("started_at").notNull(),
  saleDurationMs: integer("sale_duration_ms").notNull(),
  reminderDelayMs: integer("reminder_delay_ms").notNull(),
  reoffer4hMs: integer("reoffer_4h_ms").notNull(),
  reoffer24hMs: integer("reoffer_24h_ms").notNull(),
  createdAt: text("created_at").notNull(),
})

export const messageCampaigns = sqliteTable("message_campaigns", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  message: text("message").notNull(),
  type: text("type").notNull(),
  filter: text("filter").notNull(),
  scheduledAt: text("scheduled_at"),
  delayHours: integer("delay_hours"),
  targetUserKey: text("target_user_key"),
  triggerEvent: text("trigger_event"),
  status: text("status").notNull(),
  sentToUserKeysJson: text("sent_to_user_keys_json").notNull().default("[]"),
  createdAt: text("created_at").notNull(),
  lastRunAt: text("last_run_at"),
})

export const appResets = sqliteTable("app_resets", {
  userKey: text("user_key").primaryKey(),
  payloadJson: text("payload_json").notNull(),
})
