import type { SubscriptionPlan } from "@/lib/subscription"
import {
  isYooKassaConfigured,
  listYooKassaPaymentsForPeriod,
  type YooKassaPayment,
} from "@/lib/yookassa/server"

const MSK_OFFSET = "+03:00"

export type RevenueBucket = "monthly_new" | "monthly_renewal" | "yearly"

export interface DailyRevenueReport {
  reportDateMsk: string
  labelDateMsk: string
  monthlyNew: Map<number, number>
  monthlyRenewal: Map<number, number>
  yearly: Map<number, number>
  truncated: boolean
  paymentCount: number
}

function parseAmountRub(value: string): number {
  const n = Number(value.replace(",", ".").replace(/\s/g, ""))
  return Number.isFinite(n) ? Math.round(n) : 0
}

export function getMskCalendarDate(from: Date = new Date(), dayOffset = 0): string {
  const shifted = new Date(from.getTime() + dayOffset * 86_400_000)
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Moscow",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(shifted)
}

export function mskDayUtcBounds(dateMsk: string): { gte: string; lt: string } {
  const startMs = new Date(`${dateMsk}T00:00:00${MSK_OFFSET}`).getTime()
  return {
    gte: new Date(startMs).toISOString(),
    lt: new Date(startMs + 86_400_000).toISOString(),
  }
}

function formatMskLabel(dateMsk: string) {
  const [y, m, d] = dateMsk.split("-").map(Number)
  const date = new Date(`${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}T12:00:00${MSK_OFFSET}`)
  return date.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Moscow",
  })
}

function paymentEffectiveIso(payment: YooKassaPayment): string | null {
  return payment.captured_at ?? payment.created_at ?? null
}

function isSubscriptionPayment(payment: YooKassaPayment): payment is YooKassaPayment & {
  metadata: { plan: SubscriptionPlan }
} {
  if (payment.status !== "succeeded" || !payment.paid) return false
  if (payment.amount.currency !== "RUB") return false
  const plan = payment.metadata?.plan
  return plan === "monthly" || plan === "yearly"
}

export function isMonthlyRenewalPayment(payment: YooKassaPayment): boolean {
  if (payment.metadata?.renewal === "true") return true
  const desc = payment.description ?? ""
  return desc.toLowerCase().includes("автопродление")
}

function classifyPayment(payment: YooKassaPayment): RevenueBucket | null {
  if (!isSubscriptionPayment(payment)) return null
  const plan = payment.metadata.plan
  if (plan === "yearly") return "yearly"
  return isMonthlyRenewalPayment(payment) ? "monthly_renewal" : "monthly_new"
}

function addToMap(map: Map<number, number>, amountRub: number) {
  map.set(amountRub, (map.get(amountRub) ?? 0) + 1)
}

function paymentBelongsToMskDay(payment: YooKassaPayment, dateMsk: string): boolean {
  const iso = paymentEffectiveIso(payment)
  if (!iso) return false
  return getMskCalendarDate(new Date(iso), 0) === dateMsk
}

async function fetchPaymentsForMskDay(dateMsk: string): Promise<{
  payments: YooKassaPayment[]
  truncated: boolean
}> {
  const { gte, lt } = mskDayUtcBounds(dateMsk)
  const byId = new Map<string, YooKassaPayment>()
  let truncated = false

  const captured = await listYooKassaPaymentsForPeriod({
    gte,
    lt,
    timeField: "captured_at",
  })
  truncated = truncated || captured.truncated
  for (const p of captured.items) {
    if (paymentBelongsToMskDay(p, dateMsk)) byId.set(p.id, p)
  }

  const created = await listYooKassaPaymentsForPeriod({
    gte,
    lt,
    timeField: "created_at",
  })
  truncated = truncated || created.truncated
  for (const p of created.items) {
    if (!byId.has(p.id) && paymentBelongsToMskDay(p, dateMsk)) {
      byId.set(p.id, p)
    }
  }

  return { payments: [...byId.values()], truncated }
}

export async function buildDailyRevenueReport(input?: {
  dateMsk?: string
}): Promise<DailyRevenueReport> {
  if (!isYooKassaConfigured()) {
    throw new Error("YOOKASSA_NOT_CONFIGURED")
  }

  const reportDateMsk = input?.dateMsk ?? getMskCalendarDate(new Date(), -1)
  const { payments, truncated } = await fetchPaymentsForMskDay(reportDateMsk)

  const monthlyNew = new Map<number, number>()
  const monthlyRenewal = new Map<number, number>()
  const yearly = new Map<number, number>()

  for (const payment of payments) {
    const bucket = classifyPayment(payment)
    if (!bucket) continue
    const amountRub = parseAmountRub(payment.amount.value)
    if (amountRub <= 0) continue

    if (bucket === "monthly_new") addToMap(monthlyNew, amountRub)
    else if (bucket === "monthly_renewal") addToMap(monthlyRenewal, amountRub)
    else addToMap(yearly, amountRub)
  }

  const paymentCount =
    sumMapCounts(monthlyNew) + sumMapCounts(monthlyRenewal) + sumMapCounts(yearly)

  return {
    reportDateMsk,
    labelDateMsk: formatMskLabel(reportDateMsk),
    monthlyNew,
    monthlyRenewal,
    yearly,
    truncated,
    paymentCount,
  }
}

function sumMapCounts(map: Map<number, number>) {
  let n = 0
  for (const c of map.values()) n += c
  return n
}

export function sumMapAmounts(map: Map<number, number>) {
  let total = 0
  for (const [amount, count] of map.entries()) {
    total += amount * count
  }
  return total
}

export function formatRubInteger(amount: number) {
  return `${amount.toLocaleString("ru-RU")} ₽`
}

function formatBucketLines(map: Map<number, number>): string[] {
  if (map.size === 0) return ["— нет"]
  const amounts = [...map.keys()].sort((a, b) => a - b)
  return amounts.map((amount) => {
    const count = map.get(amount)!
    const lineTotal = amount * count
    return `• ${count} × ${formatRubInteger(amount)} = ${formatRubInteger(lineTotal)}`
  })
}

export function formatDailyRevenueReportText(report: DailyRevenueReport): string {
  const monthlyNewTotal = sumMapAmounts(report.monthlyNew)
  const monthlyRenewalTotal = sumMapAmounts(report.monthlyRenewal)
  const yearlyTotal = sumMapAmounts(report.yearly)
  const gross = monthlyNewTotal + monthlyRenewalTotal + yearlyTotal
  const net = Math.round(gross * 0.89)

  if (report.paymentCount === 0) {
    return [
      `Итоги за ${report.labelDateMsk} (MSK)`,
      "",
      "Успешных оплат подписок не было.",
      "",
      "По времени зачисления ЮKassa.",
      report.truncated ? "⚠️ Выборка из API обрезана (лимит страниц)." : "",
    ]
      .filter(Boolean)
      .join("\n")
  }

  const lines = [
    `Итоги за ${report.labelDateMsk} (MSK)`,
    "По времени зачисления ЮKassa.",
    "",
    "Новые месячные:",
    ...formatBucketLines(report.monthlyNew),
    `Итого: ${formatRubInteger(monthlyNewTotal)}`,
    "",
    "Автопродления:",
    ...formatBucketLines(report.monthlyRenewal),
    `Итого: ${formatRubInteger(monthlyRenewalTotal)}`,
    "",
    "Годовые:",
    ...formatBucketLines(report.yearly),
    `Итого: ${formatRubInteger(yearlyTotal)}`,
    "",
    `Всего: ${formatRubInteger(gross)}`,
    `После 11%: ${formatRubInteger(net)}`,
  ]

  if (report.truncated) {
    lines.push("", "⚠️ Не все страницы списка ЮKassa загружены — цифры могут быть занижены.")
  }

  return lines.join("\n")
}
