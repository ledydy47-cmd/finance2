import { NextResponse } from "next/server"
import {
  shouldRetryFlashSaleReminder,
  tryDeliverFlashSaleReminder,
} from "@/lib/server/flash-sale-cron-service"

function isAuthorized(request: Request) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) return false
  return request.headers.get("authorization") === `Bearer ${cronSecret}`
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 })
  }

  try {
    const body = (await request.json()) as {
      userKey?: string
      startedAt?: string
    }

    if (!body.userKey?.trim() || !body.startedAt?.trim()) {
      return NextResponse.json({ error: "MISSING_FIELDS" }, { status: 400 })
    }

    const result = await tryDeliverFlashSaleReminder({
      userKey: body.userKey.trim(),
      startedAt: body.startedAt.trim(),
      now: new Date(),
    })

    if (shouldRetryFlashSaleReminder(result)) {
      console.warn("[flash-sale-reminder-deliver] retryable", body.userKey, result.reason)
      return NextResponse.json({ ok: false, ...result }, { status: 503 })
    }

    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    console.error("[subscription/flash-sale-reminder-deliver]", error)
    return NextResponse.json({ error: "DELIVER_FAILED" }, { status: 500 })
  }
}
