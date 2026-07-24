import { NextResponse } from "next/server"
import { activatePendingFlashSaleOffer } from "@/lib/server/flash-sale-cron-service"

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { userKey?: string }
    if (!body.userKey?.trim()) {
      return NextResponse.json({ error: "MISSING_USER_KEY" }, { status: 400 })
    }

    const result = await activatePendingFlashSaleOffer(body.userKey.trim())
    return NextResponse.json(result)
  } catch (error) {
    console.error("[subscription/activate-flash-offer]", error)
    return NextResponse.json({ error: "ACTIVATE_FAILED" }, { status: 500 })
  }
}
