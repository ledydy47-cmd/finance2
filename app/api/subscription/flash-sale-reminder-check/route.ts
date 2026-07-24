import { NextResponse } from "next/server"
import { processUserFlashSaleReminder } from "@/lib/server/flash-sale-cron-service"

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { userKey?: string }
    if (!body.userKey?.trim()) {
      return NextResponse.json({ error: "MISSING_USER_KEY" }, { status: 400 })
    }

    const result = await processUserFlashSaleReminder(body.userKey.trim())
    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    console.error("[subscription/flash-sale-reminder-check]", error)
    return NextResponse.json({ error: "CHECK_FAILED" }, { status: 500 })
  }
}
