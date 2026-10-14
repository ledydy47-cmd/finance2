import type { SupportTicket } from "@/lib/server/support-types"
import type { SubscriptionPlan } from "@/lib/subscription"
import { PLAN_CONFIG } from "@/lib/subscription"
import { getAppBaseUrl } from "@/lib/yookassa/server"
import { parseTelegramUserId } from "@/lib/server/subscription-store"
import { findTelegramUserByUsername } from "@/lib/server/telegram-users"
import { formatPeriodEnd, sendTelegramNotification } from "@/lib/server/telegram-notify"

const DEFAULT_ADMIN_TELEGRAM_USER_ID = 2111239214

export function getAdminTelegramUserId() {
  const fromEnv = process.env.ADMIN_NOTIFY_TELEGRAM_ID?.trim()
  if (fromEnv && Number.isFinite(Number(fromEnv))) {
    return Number(fromEnv)
  }
  return DEFAULT_ADMIN_TELEGRAM_USER_ID
}

/**
 * Дополнительные получатели уведомлений о покупке подписки.
 * Берутся из `data/admin-notify-recipients.json` (или KV-ключа) и из
 * необязательной переменной окружения ADMIN_NOTIFY_TELEGRAM_IDS (id через запятую).
 */
async function getSubscriptionNotifyTelegramUserIds(): Promise<number[]> {
  const ids = new Set<number>()
  ids.add(getAdminTelegramUserId())

  for (const raw of (process.env.ADMIN_NOTIFY_TELEGRAM_IDS ?? "").split(",")) {
    const id = Number(raw.trim())
    if (Number.isFinite(id) && id > 0) ids.add(id)
  }

  try {
    const { readAdminNotifyRecipients } = await import(
      "@/lib/server/admin-notify-recipients-store"
    )
    const snapshot = await readAdminNotifyRecipients()

    for (const recipient of snapshot.recipients ?? []) {
      if (recipient.purchaseNotifications === false) continue

      if (recipient.telegramUserId && Number.isFinite(recipient.telegramUserId)) {
        ids.add(recipient.telegramUserId)
        continue
      }

      if (recipient.username) {
        const resolved = await resolveUsernameToTelegramId(recipient.username)
        if (resolved) {
          ids.add(resolved)
        } else {
          console.warn(
            `[admin-telegram-notify] не удалось определить Telegram ID для @${recipient.username} — получателю нужно нажать Start в боте`,
          )
        }
      }
    }
  } catch (error) {
    console.error("[admin-telegram-notify] не удалось прочитать список получателей", error)
  }

  return [...ids]
}

/**
 * Telegram позволяет боту писать только тем, кто уже начал с ним диалог,
 * поэтому резолвим @username через базу зарегистрированных пользователей,
 * а затем — через getChat как запасной вариант.
 */
async function resolveUsernameToTelegramId(username: string): Promise<number | null> {
  const handle = username.replace(/^@/, "").trim()
  if (!handle) return null

  const registered = await findTelegramUserByUsername(handle)
  if (registered) return registered.telegramUserId

  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) return null

  try {
    const response = await fetch(
      `https://api.telegram.org/bot${token}/getChat?chat_id=${encodeURIComponent(`@${handle}`)}`,
      { cache: "no-store" },
    )
    if (!response.ok) return null
    const payload = (await response.json()) as { ok?: boolean; result?: { id?: number } }
    return payload.ok && payload.result?.id ? payload.result.id : null
  } catch (error) {
    console.error("[admin-telegram-notify] getChat failed", handle, error)
    return null
  }
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

async function loadPaymentAnalytics(userKey: string) {
  const { getUserAnalyticsRecord } = await import("@/lib/server/user-analytics-store")
  return getUserAnalyticsRecord(userKey)
}

function formatPaymentUserLabel(
  userKey: string,
  analyticsUser: Awaited<ReturnType<typeof loadPaymentAnalytics>>,
) {
  const telegramUserId = parseTelegramUserId(userKey)
  const parts = [
    analyticsUser?.userName?.trim() || null,
    analyticsUser?.telegramUsername
      ? `@${analyticsUser.telegramUsername.replace(/^@/, "")}`
      : null,
    telegramUserId ? `id ${telegramUserId}` : userKey,
  ].filter(Boolean)

  return parts.join(" · ")
}

function formatFirstLaunch(iso: string | null | undefined) {
  if (!iso) return "неизвестно"
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return "неизвестно"
  return date.toLocaleString("ru-RU", {
    timeZone: "Europe/Moscow",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
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
  const analyticsUser = await loadPaymentAnalytics(input.userKey)
  const userLabel = formatPaymentUserLabel(input.userKey, analyticsUser)
  const title = input.isRenewal
    ? "🔁 Продление подписки «Мани.точка»"
    : "💳 Новая оплата подписки «Мани.точка»"

  const text = [
    title,
    "",
    `План: ${planLabel} · ${amount}`,
    `Пользователь: ${userLabel}`,
    `Первый запуск: ${formatFirstLaunch(analyticsUser?.appOpenedAt)}`,
    `Доступ до: ${formatPeriodEnd(input.currentPeriodEnd)}`,
    `Payment ID: ${input.paymentId}`,
  ].join("\n")

  const telegramUserIds = await getSubscriptionNotifyTelegramUserIds()
  const results = await Promise.allSettled(
    telegramUserIds.map((telegramUserId) =>
      sendTelegramNotification({ telegramUserId, text }),
    ),
  )

  const delivered = telegramUserIds.filter(
    (_id, index) => results[index]?.status === "fulfilled" && results[index]?.value?.ok,
  )

  return {
    ok: delivered.length > 0,
    deliveredTo: delivered,
    attempted: telegramUserIds,
  }
}

export async function notifyAdminDailyRevenueReport(text: string) {
  return sendTelegramNotification({
    telegramUserId: getAdminTelegramUserId(),
    text,
  })
}
