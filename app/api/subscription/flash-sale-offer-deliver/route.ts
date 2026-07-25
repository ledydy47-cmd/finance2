import { NextResponse } from "next/server"
import {
  shouldRetryFlashSaleReoffer,
  tryDeliverFlashSaleReoffer,
  type FlashSaleReofferType,
} from "@/lib/server/flash-sale-cron-service"

function isAuthorized(request: Request) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) return false
  return request.headers.get("authorization") === `Bearer ${cronSecret}`
}

function isReofferType(value: unknown): value is FlashSaleReofferType {
  return value === "4h" || value === "24h"
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 })
  }

  try {
    const body = (await request.json()) as {
      userKey?: string
      startedAt?: string
      offer?: FlashSaleReofferType
    }

    if (!body.userKey?.trim() || !body.startedAt?.trim() || !isReofferType(body.offer)) {
      return NextResponse.json({ error: "MISSING_FIELDS" }, { status: 400 })
    }

    const result = await tryDeliverFlashSaleReoffer({
      userKey: body.userKey.trim(),
      startedAt: body.startedAt.trim(),
      offer: body.offer,
      now: new Date(),
    })

    if (shouldRetryFlashSaleReoffer(result)) {
      console.warn("[flash-sale-offer-deliver] retryable", body.userKey, body.offer, result.reason)
      return NextResponse.json({ ok: false, ...result }, { status: 503 })
    }

    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    console.error("[subscription/flash-sale-offer-deliver]", error)
    return NextResponse.json({ error: "DELIVER_FAILED" }, { status: 500 })
  }
}
