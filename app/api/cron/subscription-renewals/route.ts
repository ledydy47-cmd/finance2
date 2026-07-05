import { NextResponse } from "next/server"
import { processDueRenewals } from "@/lib/server/subscription-service"

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization")
  const cronSecret = process.env.CRON_SECRET

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 })
  }

  try {
    const results = await processDueRenewals(new Date())
    return NextResponse.json({ ok: true, results })
  } catch (error) {
    console.error("[cron/subscription-renewals]", error)
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  return GET(request)
}
