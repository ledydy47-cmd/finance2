import { buildArchive, getCurrentPeriodKey } from "./calculations"
import {
  getAvailablePeriodKeys,
  getPeriodKey,
  getPeriodLabelFromKey,
  isDateInPeriod,
} from "./period"
import type { AppData } from "./types"

export function getCalendarPeriodKey(data: AppData) {
  return getCurrentPeriodKey(data.settings.monthStartDay)
}

export function isNewPeriodPending(data: AppData) {
  if (!data.settings.onboardingCompleted) return false
  return getCalendarPeriodKey(data) !== data.lastPeriodKey
}

function ensurePeriodArchived(data: AppData, periodKey: string): AppData {
  if (data.archives.some((archive) => archive.periodKey === periodKey)) return data

  const { monthStartDay, budgetPlan } = data.settings
  const label = getPeriodLabelFromKey(periodKey, monthStartDay)
  const archive = buildArchive(data.transactions, data.categories, periodKey, monthStartDay, label, {
    includeExcluded: true,
    budgetPlan,
  })
  if (archive.income <= 0 && archive.spent <= 0) return data

  return { ...data, archives: [...data.archives, archive] }
}

function advanceToCurrentPeriod(data: AppData): AppData {
  const currentKey = getCalendarPeriodKey(data)
  const previousKey = data.lastPeriodKey
  if (previousKey === currentKey) return data

  const next = ensurePeriodArchived(data, previousKey)
  return { ...next, lastPeriodKey: currentKey }
}

/** Archive previous period and advance lastPeriodKey (new month «Обнулить»). */
export function applyNewMonthReset(data: AppData): AppData {
  return advanceToCurrentPeriod(data)
}

/** Dismiss new-month modal («Позже») — still archives the previous period for analytics. */
export function acknowledgeNewMonthLater(data: AppData): AppData {
  return advanceToCurrentPeriod(data)
}

/** Backfill analytics archives for past periods that have transactions but were never archived. */
export function repairMissingPeriodArchives(data: AppData): AppData {
  const currentKey = getCalendarPeriodKey(data)
  const { monthStartDay } = data.settings
  const periodKeys = getAvailablePeriodKeys(
    data.transactions.map((tx) => tx.date),
    data.archives.map((archive) => archive.periodKey),
    currentKey,
    monthStartDay,
  )

  let next = data
  for (const periodKey of periodKeys) {
    if (periodKey >= currentKey) continue
    next = ensurePeriodArchived(next, periodKey)
  }
  return next
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

export function getPeriodsWithExcludedExpenses(data: AppData) {
  const { monthStartDay } = data.settings
  const keys = new Set<string>()

  for (const tx of data.transactions) {
    if (tx.type === "expense" && tx.excludedFromBudget) {
      keys.add(getPeriodKey(new Date(tx.date), monthStartDay))
    }
  }

  return Array.from(keys).sort().reverse()
}

/** Restore manually reset expenses back into budget counters for a period. */
export function restorePeriodSpending(data: AppData, periodKey: string): AppData {
  const { monthStartDay } = data.settings

  const transactions = data.transactions.map((tx) => {
    if (
      tx.type !== "expense" ||
      !tx.excludedFromBudget ||
      !isDateInPeriod(tx.date, periodKey, monthStartDay)
    ) {
      return tx
    }

    const { excludedFromBudget: _removed, ...rest } = tx
    return rest
  })

  return { ...data, transactions }
}
