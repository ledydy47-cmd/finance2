import { getTursoClient, hasTursoConfig } from "@/lib/db/client"
import { isTursoWriteBlockedError } from "@/lib/db/turso-errors"

const INIT_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS user_analytics (
    user_key TEXT PRIMARY KEY NOT NULL,
    telegram_user_id INTEGER,
    telegram_username TEXT,
    user_name TEXT,
    age INTEGER,
    app_opened_at TEXT,
    onboarding_started_at TEXT,
    onboarding_completed_at TEXT,
    walkthrough_completed_at TEXT,
    home_walkthrough_completed INTEGER,
    first_expense_added INTEGER,
    paywall_shown_at TEXT,
    subscribed_monthly_at TEXT,
    subscribed_yearly_at TEXT,
    auto_renew_canceled_at TEXT,
    subscription_plan TEXT NOT NULL DEFAULT 'none',
    last_visit_at TEXT NOT NULL,
    events_json TEXT NOT NULL DEFAULT '[]'
  )`,
  `CREATE INDEX IF NOT EXISTS user_analytics_last_visit_idx ON user_analytics(last_visit_at)`,
  `CREATE TABLE IF NOT EXISTS subscriptions (
    user_key TEXT PRIMARY KEY NOT NULL,
    telegram_user_id INTEGER,
    payment_method_id TEXT,
    subscription_type TEXT NOT NULL,
    current_period_end TEXT NOT NULL,
    auto_renew INTEGER NOT NULL,
    status TEXT NOT NULL,
    renewal_attempts INTEGER NOT NULL DEFAULT 0,
    last_payment_id TEXT,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS telegram_users (
    user_key TEXT PRIMARY KEY NOT NULL,
    telegram_user_id INTEGER NOT NULL,
    username TEXT,
    first_name TEXT,
    updated_at TEXT NOT NULL
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS telegram_users_username_idx ON telegram_users(username)`,
  `CREATE TABLE IF NOT EXISTS support_tickets (
    id TEXT PRIMARY KEY NOT NULL,
    user_key TEXT NOT NULL,
    telegram_user_id INTEGER,
    telegram_username TEXT,
    user_name TEXT,
    message TEXT NOT NULL,
    source TEXT NOT NULL DEFAULT 'app',
    status TEXT NOT NULL,
    reply TEXT,
    created_at TEXT NOT NULL,
    replied_at TEXT
  )`,
  `CREATE INDEX IF NOT EXISTS support_tickets_created_idx ON support_tickets(created_at)`,
  `CREATE TABLE IF NOT EXISTS pending_payments (
    user_key TEXT PRIMARY KEY NOT NULL,
    payment_id TEXT NOT NULL,
    order_id TEXT NOT NULL,
    plan TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS pending_payments_order_idx ON pending_payments(order_id)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS pending_payments_payment_idx ON pending_payments(payment_id)`,
  `CREATE TABLE IF NOT EXISTS flash_sales (
    user_key TEXT PRIMARY KEY NOT NULL,
    started_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS flash_sale_reminders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_key TEXT NOT NULL,
    started_at TEXT NOT NULL,
    remind_at TEXT NOT NULL,
    sent INTEGER NOT NULL DEFAULT 0
  )`,
  `CREATE INDEX IF NOT EXISTS flash_sale_reminders_due_idx ON flash_sale_reminders(remind_at, sent)`,
  `CREATE TABLE IF NOT EXISTS flash_sale_lifecycle (
    user_key TEXT PRIMARY KEY NOT NULL,
    started_at TEXT NOT NULL,
    expired_at TEXT,
    pending_offer TEXT,
    offer_4h_sent_at TEXT,
    offer_24h_sent_at TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS flash_sale_test_sessions (
    user_key TEXT PRIMARY KEY NOT NULL,
    started_at TEXT NOT NULL,
    sale_duration_ms INTEGER NOT NULL,
    reminder_delay_ms INTEGER NOT NULL,
    reoffer_4h_ms INTEGER NOT NULL,
    reoffer_24h_ms INTEGER NOT NULL,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS message_campaigns (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT NOT NULL,
    filter TEXT NOT NULL,
    scheduled_at TEXT,
    delay_hours INTEGER,
    target_user_key TEXT,
    trigger_event TEXT,
    status TEXT NOT NULL,
    sent_to_user_keys_json TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL,
    last_run_at TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS app_resets (
    user_key TEXT PRIMARY KEY NOT NULL,
    payload_json TEXT NOT NULL
  )`,
]

const MIGRATION_STATEMENTS = [
  `ALTER TABLE user_analytics ADD COLUMN onboarding_reoffer_1h_scheduled_at TEXT`,
  `ALTER TABLE user_analytics ADD COLUMN onboarding_reoffer_1h_sent_at TEXT`,
  `ALTER TABLE support_tickets ADD COLUMN source TEXT NOT NULL DEFAULT 'app'`,
  `ALTER TABLE flash_sale_lifecycle ADD COLUMN promotion_id TEXT`,
  `ALTER TABLE flash_sale_lifecycle ADD COLUMN pending_promotion_id TEXT`,
]

export async function initTursoSchema() {
  if (!hasTursoConfig()) {
    throw new Error("TURSO_NOT_CONFIGURED")
  }

  const client = getTursoClient()
  try {
    for (const statement of INIT_STATEMENTS) {
      await client.execute(statement)
    }

    for (const statement of MIGRATION_STATEMENTS) {
      try {
        await client.execute(statement)
      } catch {
        // Column may already exist on older databases.
      }
    }
  } catch (error) {
    if (isTursoWriteBlockedError(error)) {
      console.warn(
        "[turso] schema init skipped — writes blocked on plan, assuming schema already exists",
      )
      return
    }
    throw error
  }
}
