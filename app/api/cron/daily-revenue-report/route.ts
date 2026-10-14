import { NextResponse } from "next/server"
import {
  buildDailyRevenueReport,
  formatDailyRevenueReportText,
} from "@/lib/server/daily-revenue-report-service"
import { notifyAdminDailyRevenueReport } from "@/lib/server/admin-telegram-notify"

function isAuthorized(request: Request) {
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return false
  }
  return true
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 })
  }

  try {
    const url = new URL(request.url)
    const dateMsk = url.searchParams.get("date")?.trim() || undefined

    const report = await buildDailyRevenueReport(dateMsk ? { dateMsk } : undefined)
    const text = formatDailyRevenueReportText(report)
    await notifyAdminDailyRevenueReport(text)

    return NextResponse.json({
      ok: true,
      reportDateMsk: report.reportDateMsk,
      paymentCount: report.paymentCount,
      truncated: report.truncated,
    })
  } catch (error) {
    console.error("[cron/daily-revenue-report]", error)
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  return GET(request)
}
