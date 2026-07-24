import { NextResponse } from "next/server"
import { processFlashSaleCronJobs } from "@/lib/server/flash-sale-cron-service"
import { processScheduledCampaigns } from "@/lib/server/user-analytics-service"

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  const auth = request.headers.get("authorization")
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 })
  }

  try {
    const campaigns = await processScheduledCampaigns()
    const flashSale = await processFlashSaleCronJobs(new Date())
    return NextResponse.json({ ok: true, campaigns, flashSale })
  } catch (error) {
    console.error("[cron/scheduled-messages]", error)
    return NextResponse.json({ error: "CRON_FAILED" }, { status: 500 })
  }
}
