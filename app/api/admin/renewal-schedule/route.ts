import { NextResponse } from "next/server"
import { isAdminSupportAuthorized } from "@/lib/server/admin-auth"
import { listSubscriptions } from "@/lib/server/subscription-store"

function utcDateKey(iso: string) {
  return new Date(iso).toISOString().slice(0, 10)
}

function enumerateDays(fromYmd: string, toYmd: string) {
  const days: string[] = []
  const cursor = new Date(`${fromYmd}T12:00:00.000Z`)
  const end = new Date(`${toYmd}T12:00:00.000Z`)
  while (cursor <= end) {
    days.push(cursor.toISOString().slice(0, 10))
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }
  return days
}

export async function GET(request: Request) {
  if (!isAdminSupportAuthorized(request)) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 })
  }

  try {
    const url = new URL(request.url)
    const fromYmd = url.searchParams.get("from")?.trim() || "2026-09-04"
    const toYmd = url.searchParams.get("to")?.trim() || "2026-09-10"

    const records = await listSubscriptions()
    const days = enumerateDays(fromYmd, toYmd)
    const byDay = Object.fromEntries(
      days.map((day) => [
        day,
        {
          chargeAttempts: 0,
          monthly: 0,
          yearly: 0,
          expireOnly: 0,
          missingPaymentMethod: 0,
        },
      ]),
    )

    for (const record of records) {
      const day = utcDateKey(record.currentPeriodEnd)
      if (day < fromYmd || day > toYmd) continue
      const bucket = byDay[day]
      if (!bucket) continue

      if (record.autoRenew && record.paymentMethodId) {
        bucket.chargeAttempts += 1
        if (record.subscriptionType === "monthly") bucket.monthly += 1
        if (record.subscriptionType === "yearly") bucket.yearly += 1
      } else if (record.autoRenew && !record.paymentMethodId) {
        bucket.missingPaymentMethod += 1
      } else {
        bucket.expireOnly += 1
      }
    }

    const schedule = days.map((day) => ({ day, ...byDay[day] }))
    const totals = schedule.reduce(
      (acc, row) => ({
        chargeAttempts: acc.chargeAttempts + row.chargeAttempts,
        monthly: acc.monthly + row.monthly,
        yearly: acc.yearly + row.yearly,
        expireOnly: acc.expireOnly + row.expireOnly,
        missingPaymentMethod: acc.missingPaymentMethod + row.missingPaymentMethod,
      }),
      { chargeAttempts: 0, monthly: 0, yearly: 0, expireOnly: 0, missingPaymentMethod: 0 },
    )

    return NextResponse.json({
      ok: true,
      from: fromYmd,
      to: toYmd,
      cronNote: "Cron /api/cron/subscription-renewals — ежедневно 06:00 UTC (09:00 МСK)",
      totals,
      schedule,
    })
  } catch (error) {
    console.error("[admin/renewal-schedule]", error)
    return NextResponse.json({ error: "SCHEDULE_FAILED" }, { status: 500 })
  }
}
