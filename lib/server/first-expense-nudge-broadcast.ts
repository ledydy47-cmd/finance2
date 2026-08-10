import { readAnalyticsStore } from "@/lib/server/user-analytics-store"
import { getServerSubscriptionStatus } from "@/lib/server/subscription-service"
import { sendTelegramNotification } from "@/lib/server/telegram-notify"
import { parseTelegramUserId } from "@/lib/server/subscription-store"
import {
  formatDateInAnalyticsTimezone,
  hasAddedFirstExpense,
} from "@/lib/server/user-analytics-service"
import type { UserAnalyticsRecord } from "@/lib/server/user-analytics-types"

export const DEFAULT_FIRST_EXPENSE_NUDGE_MESSAGE = `Понедельник — самый удачный день, чтобы начать по-новому. {имя}, ты уже настроила «Мани.точку» под свою мечту — осталось только добавить первую трату ✨

Открой приложение → «+» → любой расход за сегодня.

Мы рядом, если что-то непонятно 💗`

function formatNudgeMessage(template: string, userName: string | null) {
  const name = userName?.trim() || "Привет"
  return template.replace(/\{имя\}/g, name)
}

function firstOpenedOnDates(user: UserAnalyticsRecord, dates: Set<string>) {
  if (!user.appOpenedAt) return false
  return dates.has(formatDateInAnalyticsTimezone(new Date(user.appOpenedAt)))
}

export async function broadcastFirstExpenseNudge(input?: {
  datesYmd?: string[]
  message?: string
  offset?: number
  limit?: number
}) {
  const template = input?.message?.trim() || DEFAULT_FIRST_EXPENSE_NUDGE_MESSAGE
  const offset = Math.max(0, input?.offset ?? 0)
  const limit = input?.limit && input.limit > 0 ? Math.floor(input.limit) : null
  const dates = new Set(input?.datesYmd?.length ? input.datesYmd : ["2026-08-08", "2026-08-09"])

  const allCandidates = Object.values((await readAnalyticsStore()).users).filter((user) => {
    if (!user.telegramUserId && !parseTelegramUserId(user.userKey)) return false
    if (!firstOpenedOnDates(user, dates)) return false
    if (hasAddedFirstExpense(user)) return false
    if (user.subscriptionPlan !== "none") return false
    return true
  })

  const candidates = limit
    ? allCandidates.slice(offset, offset + limit)
    : allCandidates.slice(offset)

  const results: Array<{ userKey: string; sent: boolean; reason?: string }> = []

  for (const user of candidates) {
    const subscription = await getServerSubscriptionStatus(user.userKey)
    if (subscription?.active) {
      results.push({ userKey: user.userKey, sent: false, reason: "SUBSCRIBED" })
      continue
    }

    const { isUserKeyBlocked } = await import("@/lib/server/blocked-users-service")
    if (await isUserKeyBlocked(user.userKey)) {
      results.push({ userKey: user.userKey, sent: false, reason: "USER_BLOCKED" })
      continue
    }

    const telegramUserId = user.telegramUserId ?? parseTelegramUserId(user.userKey)
    if (!telegramUserId) {
      results.push({ userKey: user.userKey, sent: false, reason: "NO_TELEGRAM" })
      continue
    }

    const text = formatNudgeMessage(template, user.userName)
    const sendResult = await sendTelegramNotification({ telegramUserId, text })

    if (!sendResult.ok) {
      results.push({
        userKey: user.userKey,
        sent: false,
        reason: sendResult.reason ?? "SEND_FAILED",
      })
      continue
    }

    results.push({ userKey: user.userKey, sent: true })
  }

  return {
    dates: [...dates],
    total: allCandidates.length,
    batchOffset: offset,
    batchLimit: limit,
    batchSize: candidates.length,
    sent: results.filter((item) => item.sent).length,
    failed: results.filter((item) => !item.sent).length,
    results,
  }
}
