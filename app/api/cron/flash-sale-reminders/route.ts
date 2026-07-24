import { NextResponse } from "next/server"
import { processFlashSaleReminders } from "@/lib/server/flash-sale-reminder-service"

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization")
  const cronSecret = process.env.CRON_SECRET

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 })
  }

  try {
    const result = await processFlashSaleReminders(new Date())
    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    console.error("[cron/flash-sale-reminders]", error)
    return NextResponse.json({ error: "CRON_FAILED" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  return GET(request)
}
