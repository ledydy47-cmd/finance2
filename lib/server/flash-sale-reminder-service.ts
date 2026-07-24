import { FLASH_SALE_DURATION_MS } from "@/lib/paywall-experiment"
import {
  readFlashSaleReminders,
  writeFlashSaleReminders,
  getFlashSaleStartedAt,
} from "@/lib/server/flash-sale-store"
import { getServerSubscriptionStatus } from "@/lib/server/subscription-service"
import { sendMessageToUser } from "@/lib/server/user-analytics-service"

export const FLASH_SALE_REMINDER_MESSAGE =
  "скидка −50% заканчивается через 5 минут — успей оформить подписку, пока цена зафиксирована! 💗"

export async function processFlashSaleReminders(now = new Date()) {
  const reminders = await readFlashSaleReminders()
  const nowMs = now.getTime()
  let sent = 0

  for (const reminder of reminders) {
    if (reminder.sent) continue
    if (new Date(reminder.remindAt).getTime() > nowMs) continue

    const subscription = await getServerSubscriptionStatus(reminder.userKey)
    if (subscription?.active) {
      reminder.sent = true
      continue
    }

    const startedAt = await getFlashSaleStartedAt(reminder.userKey)
    if (!startedAt || startedAt !== reminder.startedAt) {
      reminder.sent = true
      continue
    }

    const expiresMs = new Date(startedAt).getTime() + FLASH_SALE_DURATION_MS
    if (nowMs >= expiresMs) {
      reminder.sent = true
      continue
    }

    const result = await sendMessageToUser({
      userKey: reminder.userKey,
      message: FLASH_SALE_REMINDER_MESSAGE,
    })
    if (result.ok) {
      reminder.sent = true
      sent += 1
    }
  }

  const cutoffMs = nowMs - 24 * 60 * 60 * 1000
  const cleaned = reminders.filter((item) => {
    if (!item.sent) return true
    return new Date(item.remindAt).getTime() > cutoffMs
  })

  await writeFlashSaleReminders(cleaned)

  return {
    sent,
    pending: cleaned.filter((item) => !item.sent).length,
  }
}
