import { NextResponse } from "next/server"
import {
  getFlashSaleStartedAt,
  scheduleFlashSaleReminder,
  setFlashSaleStartedAt,
} from "@/lib/server/flash-sale-store"
import { registerFlashSaleLifecycle } from "@/lib/server/flash-sale-lifecycle-store"

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
    const existing = await getFlashSaleStartedAt(userKey)

    if (!existing) {
      await setFlashSaleStartedAt(userKey, startedAt)
    }

    const activeStartedAt = existing ?? startedAt
    await scheduleFlashSaleReminder(userKey, activeStartedAt)
    await registerFlashSaleLifecycle(userKey, activeStartedAt)

    return NextResponse.json({ ok: true, startedAt: activeStartedAt })
  } catch (error) {
    console.error("[subscription/flash-sale-sync]", error)
    return NextResponse.json({ error: "SYNC_FAILED" }, { status: 500 })
  }
}
