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
import { getFlashSaleTiming } from "@/lib/server/flash-sale-timing"

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
    const timing = await getFlashSaleTiming(userKey, activeStartedAt)
    const reminderScheduled = await scheduleFlashSaleReminder(
      userKey,
      activeStartedAt,
      timing.reminderDelayMs,
    )
    const delivery = await scheduleFlashSaleReminderDelivery(userKey, activeStartedAt, timing)
    const reofferDeliveries = await scheduleFlashSaleReofferDeliveries(userKey, activeStartedAt, timing)
    await registerFlashSaleLifecycle(userKey, activeStartedAt)

    return NextResponse.json({
      ok: true,
      startedAt: activeStartedAt,
      saleDurationMs: timing.saleDurationMs,
      reminderScheduled,
      delivery,
      reofferDeliveries,
    })
  } catch (error) {
    console.error("[subscription/flash-sale-sync]", error)
    return NextResponse.json({ error: "SYNC_FAILED" }, { status: 500 })
  }
}
