import { NextResponse } from "next/server"
import {
  resolveFlashSaleStartedAt,
  scheduleFlashSaleReminder,
} from "@/lib/server/flash-sale-store"
import { registerFlashSaleLifecycle } from "@/lib/server/flash-sale-lifecycle-store"
import {
  scheduleFlashSaleReminderDelivery,
  scheduleFlashSaleReofferDeliveries,
} from "@/lib/server/flash-sale-reminder-scheduler"

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      userKey?: string
      startedAt?: string
    }

    if (!body.userKey?.trim() || !body.startedAt?.trim()) {
      return NextResponse.json({ error: "MISSING_FIELDS" }, { status: 400 })
    }

    const userKey = body.userKey.trim()
    const startedAt = body.startedAt.trim()
    const activeStartedAt = await resolveFlashSaleStartedAt(userKey, startedAt)
    const reminderScheduled = await scheduleFlashSaleReminder(userKey, activeStartedAt)
    const delivery = await scheduleFlashSaleReminderDelivery(userKey, activeStartedAt)
    const lifecycle = await registerFlashSaleLifecycle(userKey, activeStartedAt)
    const reoffers =
      !lifecycle.offer4hSentAt || !lifecycle.offer24hSentAt
        ? await scheduleFlashSaleReofferDeliveries(userKey, activeStartedAt)
        : { skipped: true as const }

    return NextResponse.json({
      ok: true,
      startedAt: activeStartedAt,
      reminderScheduled,
      delivery,
      reoffers,
    })
  } catch (error) {
    console.error("[subscription/flash-sale-sync]", error)
    return NextResponse.json({ error: "SYNC_FAILED" }, { status: 500 })
  }
}
