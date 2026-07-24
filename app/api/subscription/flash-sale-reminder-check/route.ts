import { NextResponse } from "next/server"
import {
  processUserFlashSaleReminder,
  tryDeliverFlashSaleReminder,
} from "@/lib/server/flash-sale-cron-service"

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { userKey?: string; startedAt?: string }
    if (!body.userKey?.trim()) {
      return NextResponse.json({ error: "MISSING_USER_KEY" }, { status: 400 })
    }

    const userKey = body.userKey.trim()
    const result = body.startedAt?.trim()
      ? await tryDeliverFlashSaleReminder({
          userKey,
          startedAt: body.startedAt.trim(),
        })
      : await processUserFlashSaleReminder(userKey)

    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    console.error("[subscription/flash-sale-reminder-check]", error)
    return NextResponse.json({ error: "CHECK_FAILED" }, { status: 500 })
  }
}
