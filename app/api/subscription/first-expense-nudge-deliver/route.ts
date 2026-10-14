import { NextResponse } from "next/server"
import {
  shouldRetryFirstExpenseNudge,
  tryDeliverFirstExpenseNudge,
} from "@/lib/server/first-expense-nudge-service"

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
      walkthroughCompletedAt?: string
    }

    if (!body.userKey?.trim() || !body.walkthroughCompletedAt?.trim()) {
      return NextResponse.json({ error: "MISSING_FIELDS" }, { status: 400 })
    }

    const result = await tryDeliverFirstExpenseNudge({
      userKey: body.userKey.trim(),
      walkthroughCompletedAt: body.walkthroughCompletedAt.trim(),
      now: new Date(),
    })

    if (shouldRetryFirstExpenseNudge(result)) {
      console.warn("[first-expense-nudge-deliver] retryable", body.userKey, result.reason)
      return NextResponse.json({ ok: false, ...result }, { status: 503 })
    }

    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    console.error("[subscription/first-expense-nudge-deliver]", error)
    return NextResponse.json({ error: "DELIVER_FAILED" }, { status: 500 })
  }
}
