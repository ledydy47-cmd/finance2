import { NextResponse } from "next/server"
import { backfillFlashSaleReoffers } from "@/lib/server/backfill-flash-sale-reoffers"

export const maxDuration = 300

function isAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret) return false

  const header = request.headers.get("authorization")
  if (header === `Bearer ${secret}`) return true

  const url = new URL(request.url)
  return url.searchParams.get("secret") === secret
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 })
  }

  try {
    const body = (await request.json().catch(() => ({}))) as {
      offset?: number
      limit?: number
      offers?: Array<"4h" | "24h">
    }

    const result = await backfillFlashSaleReoffers(body)
    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    console.error("[admin/backfill-flash-sale-reoffers]", error)
    return NextResponse.json({ error: "BACKFILL_FAILED" }, { status: 500 })
  }
}
