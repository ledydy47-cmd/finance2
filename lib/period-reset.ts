import { buildArchive, getCurrentPeriodKey } from "./calculations"
import { getPeriodLabelFromKey, isDateInPeriod } from "./period"
import type { AppData } from "./types"

export function getCalendarPeriodKey(data: AppData) {
  return getCurrentPeriodKey(data.settings.monthStartDay)
}

export function isNewPeriodPending(data: AppData) {
  if (!data.settings.onboardingCompleted) return false
  return getCalendarPeriodKey(data) !== data.lastPeriodKey
}

/** Archive previous period and advance lastPeriodKey (new month «Обнулить»). */
export function applyNewMonthReset(data: AppData): AppData {
  const currentKey = getCalendarPeriodKey(data)
  const previousKey = data.lastPeriodKey
  if (previousKey === currentKey) return data

  let next = { ...data }

    if (!next.archives.some((a) => a.periodKey === previousKey)) {
    const label = getPeriodLabelFromKey(previousKey, next.settings.monthStartDay)
    const archive = buildArchive(
      next.transactions,
      next.categories,
      previousKey,
      next.settings.monthStartDay,
      label,
      { includeExcluded: true },
    )
    if (archive.income > 0 || archive.spent > 0) {
      next = { ...next, archives: [...next.archives, archive] }
    }
  }

  return { ...next, lastPeriodKey: currentKey }
}

/** Acknowledge new month without archiving («Позже»). */
export function acknowledgeNewMonthLater(data: AppData): AppData {
  return { ...data, lastPeriodKey: getCalendarPeriodKey(data) }
}

/** Manual reset: exclude current-period expenses from budget totals (transactions kept). */
export function resetCurrentMonthSpending(data: AppData): AppData {
  const periodKey = getCalendarPeriodKey(data)
  const { monthStartDay } = data.settings

  const transactions = data.transactions.map((tx) => {
    if (
      tx.type === "expense" &&
      !tx.excludedFromBudget &&
      isDateInPeriod(tx.date, periodKey, monthStartDay)
    ) {
      return { ...tx, excludedFromBudget: true }
    }
    return tx
  })

  let next: AppData = { ...data, transactions }

  if (!next.archives.some((a) => a.periodKey === periodKey)) {
    const label = getPeriodLabelFromKey(periodKey, monthStartDay)
    const archive = buildArchive(
      next.transactions,
      next.categories,
      periodKey,
      monthStartDay,
      label,
      { includeExcluded: true, budgetPlan: next.budgetPlan },
    )
    if (archive.income > 0 || archive.spent > 0) {
      next = { ...next, archives: [...next.archives, archive] }
    }
  }

  return next
}
