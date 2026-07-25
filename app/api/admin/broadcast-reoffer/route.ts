import { NextResponse } from "next/server"
import { isAdminSupportAuthorized } from "@/lib/server/admin-auth"
import { broadcastReofferToPaywallNonSubscribers } from "@/lib/server/flash-sale-reoffer-broadcast"

export async function POST(request: Request) {
  if (!isAdminSupportAuthorized(request)) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 })
  }

  try {
    const body = (await request.json().catch(() => ({}))) as {
      message?: string
      offerType?: "4h" | "24h"
    }

    const result = await broadcastReofferToPaywallNonSubscribers({
      message: body.message,
      offerType: body.offerType,
    })

    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    console.error("[admin/broadcast-reoffer]", error)
    return NextResponse.json({ error: "BROADCAST_FAILED" }, { status: 500 })
  }
}
