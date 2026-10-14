import { NextResponse } from "next/server"
import { isAdminSupportAuthorized } from "@/lib/server/admin-auth"
import { getPromotionBroadcastStats } from "@/lib/server/promotion-stats-service"

export async function GET(request: Request) {
  if (!isAdminSupportAuthorized(request)) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 })
  }

  try {
    const promotionId =
      new URL(request.url).searchParams.get("promotionId")?.trim() || "sept1_2026"
    const stats = await getPromotionBroadcastStats(promotionId)
    return NextResponse.json({ ok: true, stats })
  } catch (error) {
    console.error("[admin/promotion-stats]", error)
    return NextResponse.json({ error: "STATS_FAILED" }, { status: 500 })
  }
}
