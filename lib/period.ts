import { formatMonthYear } from "./format"

export function getPeriodBounds(date: Date, monthStartDay: number) {
  const year = date.getFullYear()
  const month = date.getMonth()
  const day = date.getDate()

  let startMonth = month
  let startYear = year

  if (day < monthStartDay) {
    startMonth -= 1
    if (startMonth < 0) {
      startMonth = 11
      startYear -= 1
    }
  }

  const start = new Date(startYear, startMonth, monthStartDay)
  const end = new Date(startYear, startMonth + 1, monthStartDay)
  end.setMilliseconds(end.getMilliseconds() - 1)

  return { start, end }
}

export function getPeriodKey(date: Date, monthStartDay: number) {
  const { start } = getPeriodBounds(date, monthStartDay)
  const month = String(start.getMonth() + 1).padStart(2, "0")
  return `${start.getFullYear()}-${month}`
}

export function getPeriodLabel(date: Date, monthStartDay: number) {
  const { start } = getPeriodBounds(date, monthStartDay)
  return formatMonthYear(start)
}

export function isDateInPeriod(dateStr: string, periodKey: string, monthStartDay: number) {
  const date = new Date(dateStr)
  return getPeriodKey(date, monthStartDay) === periodKey
}

export function getPeriodStartDate(periodKey: string, monthStartDay: number) {
  const [year, month] = periodKey.split("-").map(Number)
  return new Date(year, month - 1, monthStartDay)
}

export function getPeriodLabelFromKey(periodKey: string, monthStartDay: number) {
  return formatMonthYear(getPeriodStartDate(periodKey, monthStartDay))
}

export function getAvailablePeriodKeys(
  transactionDates: string[],
  archiveKeys: string[],
  currentPeriodKey: string,
  monthStartDay: number,
) {
  const keys = new Set<string>([currentPeriodKey, ...archiveKeys])
  for (const dateStr of transactionDates) {
    keys.add(getPeriodKey(new Date(dateStr), monthStartDay))
  }
  return Array.from(keys).sort().reverse()
}

/** Calendar days left in the current budget period (including today). */
export function getDaysLeftInPeriod(monthStartDay: number, now = new Date()) {
  const { end } = getPeriodBounds(now, monthStartDay)
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const lastDay = new Date(end.getFullYear(), end.getMonth(), end.getDate())
  const diff = Math.round((lastDay.getTime() - today.getTime()) / 86400000)
  return Math.max(0, diff + 1)
}
