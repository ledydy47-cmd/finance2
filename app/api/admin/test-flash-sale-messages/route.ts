import { NextResponse } from "next/server"
import { clearFlashSaleLifecycle } from "@/lib/server/flash-sale-lifecycle-store"
import {
  clearFlashSaleReminder,
  clearFlashSaleStartedAt,
  scheduleFlashSaleReminder,
  setFlashSaleStartedAt,
} from "@/lib/server/flash-sale-store"
import { registerFlashSaleLifecycle } from "@/lib/server/flash-sale-lifecycle-store"
import { scheduleFlashSaleTestDeliveries } from "@/lib/server/flash-sale-reminder-scheduler"
import {
  clearFlashSaleTestSession,
  FLASH_SALE_TEST_DELAYS,
  setFlashSaleTestSession,
} from "@/lib/server/flash-sale-test-mode"
import { getReofferScheduleDelayMs } from "@/lib/server/flash-sale-timing"
import { ensureAnalyticsUser } from "@/lib/server/user-analytics-service"

function isAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret) return false

  const header = request.headers.get("authorization")
  if (header === `Bearer ${secret}`) return true

  const url = new URL(request.url)
  return url.searchParams.get("secret") === secret
}

async function clearFlashSaleState(userKey: string) {
  await clearFlashSaleStartedAt(userKey)
  await clearFlashSaleReminder(userKey)
  await clearFlashSaleLifecycle(userKey)
  await clearFlashSaleTestSession(userKey)
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 })
  }

  try {
    const body = (await request.json()) as {
      telegramUserId?: number
      telegramUsername?: string | null
      firstName?: string | null
    }

    if (!body.telegramUserId || !Number.isFinite(body.telegramUserId)) {
      return NextResponse.json({ error: "MISSING_TELEGRAM_USER_ID" }, { status: 400 })
    }

    const userKey = `tg-${body.telegramUserId}`
    const startedAt = new Date().toISOString()

    await clearFlashSaleState(userKey)
    await ensureAnalyticsUser({
      userKey,
      telegramUserId: body.telegramUserId,
      telegramUsername: body.telegramUsername,
      userName: body.firstName,
    })

    const testSession = await setFlashSaleTestSession(userKey, startedAt, FLASH_SALE_TEST_DELAYS)
    await setFlashSaleStartedAt(userKey, startedAt)
    await scheduleFlashSaleReminder(userKey, startedAt, testSession.reminderDelayMs)
    await registerFlashSaleLifecycle(userKey, startedAt)

    const schedules = await scheduleFlashSaleTestDeliveries(userKey, startedAt)
    const timing = schedules.timing

    return NextResponse.json({
      ok: true,
      userKey,
      startedAt,
      testMode: true,
      timeline: {
        reminderInSeconds: Math.ceil(timing.reminderDelayMs / 1000),
        offer4hInSeconds: Math.ceil(getReofferScheduleDelayMs(timing, "4h") / 1000),
        offer24hInSeconds: Math.ceil(getReofferScheduleDelayMs(timing, "24h") / 1000),
        saleDurationSeconds: Math.ceil(timing.saleDurationMs / 1000),
      },
      schedules,
      hint:
        "Сообщения помечены 🧪 [тест]. Открой приложение после 4h/24h сообщений, чтобы активировать новую скидку.",
    })
  } catch (error) {
    console.error("[admin/test-flash-sale-messages]", error)
    return NextResponse.json({ error: "TEST_SCHEDULE_FAILED" }, { status: 500 })
  }
}
