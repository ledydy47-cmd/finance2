import { NextResponse } from "next/server"
import { clearFlashSaleLifecycle } from "@/lib/server/flash-sale-lifecycle-store"
import {
  clearFlashSaleReminder,
  clearFlashSaleStartedAt,
  scheduleFlashSaleReminder,
  setFlashSaleStartedAt,
} from "@/lib/server/flash-sale-store"
import { registerFlashSaleLifecycle } from "@/lib/server/flash-sale-lifecycle-store"
import { saveFlashSaleLifecycle } from "@/lib/server/flash-sale-lifecycle-store"
import { scheduleFlashSaleTestDeliveries } from "@/lib/server/flash-sale-reminder-scheduler"
import {
  tryDeliverFlashSaleReoffer,
  tryDeliverFlashSaleReminder,
} from "@/lib/server/flash-sale-cron-service"
import {
  clearFlashSaleTestSession,
  FLASH_SALE_TEST_DELAYS,
  setFlashSaleTestSession,
} from "@/lib/server/flash-sale-test-mode"
import { getReofferScheduleDelayMs } from "@/lib/server/flash-sale-timing"
import { ensureAnalyticsUser } from "@/lib/server/user-analytics-service"
import { saveFlashSaleLifecycle } from "@/lib/server/flash-sale-lifecycle-store"

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
      mode?: "schedule" | "instant"
    }

    if (!body.telegramUserId || !Number.isFinite(body.telegramUserId)) {
      return NextResponse.json({ error: "MISSING_TELEGRAM_USER_ID" }, { status: 400 })
    }

    const userKey = `tg-${body.telegramUserId}`
    const mode = body.mode ?? "schedule"
    const startedAt =
      mode === "instant"
        ? new Date(Date.now() - FLASH_SALE_TEST_DELAYS.reoffer24hMs - FLASH_SALE_TEST_DELAYS.saleDurationMs - 5_000).toISOString()
        : new Date().toISOString()

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

    const lifecycle = await registerFlashSaleLifecycle(userKey, startedAt)
    lifecycle.expiredAt = new Date(
      new Date(startedAt).getTime() + testSession.saleDurationMs,
    ).toISOString()
    await saveFlashSaleLifecycle(lifecycle)

    if (mode === "instant") {
      const [reminder, offer4h, offer24h] = await Promise.all([
        tryDeliverFlashSaleReminder({ userKey, startedAt }),
        tryDeliverFlashSaleReoffer({ userKey, startedAt, offer: "4h" }),
        tryDeliverFlashSaleReoffer({ userKey, startedAt, offer: "24h" }),
      ])

      return NextResponse.json({
        ok: true,
        userKey,
        startedAt,
        testMode: true,
        mode,
        delivered: { reminder, offer4h, offer24h },
        hint: "Все 3 тестовых сообщения отправлены сразу. Открой приложение, чтобы активировать скидку после 4h/24h.",
      })
    }

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
