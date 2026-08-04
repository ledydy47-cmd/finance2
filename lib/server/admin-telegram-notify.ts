import type { SupportTicket } from "@/lib/server/support-types"
import type { SubscriptionPlan } from "@/lib/subscription"
import { PLAN_CONFIG } from "@/lib/subscription"
import { getAppBaseUrl } from "@/lib/yookassa/server"
import { parseTelegramUserId } from "@/lib/server/subscription-store"
import { formatPeriodEnd, sendTelegramNotification } from "@/lib/server/telegram-notify"

const DEFAULT_ADMIN_TELEGRAM_USER_ID = 2111239214

export function getAdminTelegramUserId() {
  const fromEnv = process.env.ADMIN_NOTIFY_TELEGRAM_ID?.trim()
  if (fromEnv && Number.isFinite(Number(fromEnv))) {
    return Number(fromEnv)
  }
  return DEFAULT_ADMIN_TELEGRAM_USER_ID
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("ru-RU", {
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function formatRubAmount(value: string) {
  const numeric = Number(value.replace(",", "."))
  if (!Number.isFinite(numeric)) return `${value} ₽`
  return `${numeric.toLocaleString("ru-RU")} ₽`
}

async function formatPaymentUserLabel(userKey: string) {
  const telegramUserId = parseTelegramUserId(userKey)
  const { getUserAnalyticsRecord } = await import("@/lib/server/user-analytics-store")
  const analyticsUser = await getUserAnalyticsRecord(userKey)

  const parts = [
    analyticsUser?.userName?.trim() || null,
    analyticsUser?.telegramUsername
      ? `@${analyticsUser.telegramUsername.replace(/^@/, "")}`
      : null,
    telegramUserId ? `id ${telegramUserId}` : userKey,
  ].filter(Boolean)

  return parts.join(" · ")
}

function formatSupportUser(ticket: SupportTicket) {
  return [
    ticket.userName,
    ticket.telegramUsername ? `@${ticket.telegramUsername}` : null,
    ticket.telegramUserId ? `id ${ticket.telegramUserId}` : ticket.userKey,
  ]
    .filter(Boolean)
    .join(" · ")
}

export async function notifyAdminNewSupportTicket(ticket: SupportTicket) {
  const adminUrl = `${getAppBaseUrl()}/admin/support?tab=support`
  const title =
    ticket.source === "bot"
      ? "💬 Новый отзыв из бота «Мани.точка»"
      : "💬 Новое обращение в поддержку «Мани.точка»"
  const text = [
    title,
    "",
    `Пользователь: ${formatSupportUser(ticket)}`,
    `Время: ${formatDateTime(ticket.createdAt)}`,
    "",
    "Сообщение:",
    ticket.message,
    "",
    `Ответить: ${adminUrl}`,
  ].join("\n")

  return sendTelegramNotification({
    telegramUserId: getAdminTelegramUserId(),
    text,
  })
}

export async function notifyAdminSubscriptionPayment(input: {
  userKey: string
  plan: SubscriptionPlan
  paymentId: string
  amount?: string
  currentPeriodEnd: string
  isRenewal?: boolean
}) {
  const planLabel = PLAN_CONFIG[input.plan].label
  const amount = formatRubAmount(input.amount ?? PLAN_CONFIG[input.plan].amount)
  const userLabel = await formatPaymentUserLabel(input.userKey)
  const title = input.isRenewal
    ? "🔁 Продление подписки «Мани.точка»"
    : "💳 Новая оплата подписки «Мани.точка»"

  const text = [
    title,
    "",
    `План: ${planLabel} · ${amount}`,
    `Пользователь: ${userLabel}`,
    `Доступ до: ${formatPeriodEnd(input.currentPeriodEnd)}`,
    `Payment ID: ${input.paymentId}`,
  ].join("\n")

  return sendTelegramNotification({
    telegramUserId: getAdminTelegramUserId(),
    text,
  })
}
