import type { Category, PeriodArchive, Transaction } from "./types"
import { getPeriodKey, isDateInPeriod } from "./period"

export function getPeriodTransactions(
  transactions: Transaction[],
  periodKey: string,
  monthStartDay: number,
  options?: { includeExcluded?: boolean },
) {
  return transactions.filter((tx) => {
    if (!options?.includeExcluded && tx.excludedFromBudget) return false
    return isDateInPeriod(tx.date, periodKey, monthStartDay)
  })
}

export function sumByType(transactions: Transaction[], type: Transaction["type"]) {
  return transactions
    .filter((tx) => tx.type === type)
    .reduce((sum, tx) => sum + tx.amount, 0)
}

export function getCategorySpent(
  transactions: Transaction[],
  categoryId: string,
  periodKey: string,
  monthStartDay: number,
) {
  return getPeriodTransactions(transactions, periodKey, monthStartDay)
    .filter((tx) => tx.type === "expense" && tx.categoryId === categoryId)
    .reduce((sum, tx) => sum + tx.amount, 0)
}

export function getCategoryExpenseCount(
  transactions: Transaction[],
  categoryId: string,
  periodKey: string,
  monthStartDay: number,
) {
  return getPeriodTransactions(transactions, periodKey, monthStartDay).filter(
    (tx) => tx.type === "expense" && tx.categoryId === categoryId,
  ).length
}

export function getMonthlySummary(
  transactions: Transaction[],
  categories: Category[],
  periodKey: string,
  monthStartDay: number,
) {
  const periodTx = getPeriodTransactions(transactions, periodKey, monthStartDay)
  const income = sumByType(periodTx, "income")
  const spent = sumByType(periodTx, "expense")
  const budgetTotal = categories.reduce((sum, c) => sum + c.monthlyLimit, 0)
  const left = income - spent

  return { income, spent, left, budgetTotal }
}

export function buildArchive(
  transactions: Transaction[],
  categories: Category[],
  periodKey: string,
  monthStartDay: number,
  label: string,
  options?: { includeExcluded?: boolean },
): PeriodArchive {
  const periodTx = getPeriodTransactions(transactions, periodKey, monthStartDay, options)
  const categorySpent: Record<string, number> = {}
  const categoryBudget: Record<string, number> = {}

  for (const category of categories) {
    categorySpent[category.id] = getPeriodTransactions(
      transactions,
      periodKey,
      monthStartDay,
      options,
    )
      .filter((tx) => tx.type === "expense" && tx.categoryId === category.id)
      .reduce((sum, tx) => sum + tx.amount, 0)
    categoryBudget[category.id] = category.monthlyLimit
  }

  return {
    periodKey,
    label,
    income: sumByType(periodTx, "income"),
    spent: sumByType(periodTx, "expense"),
    categorySpent,
    categoryBudget,
  }
}

export function getDailySpendingMap(
  transactions: Transaction[],
  periodKey: string,
  monthStartDay: number,
) {
  const map = new Map<string, number>()

  for (const tx of getPeriodTransactions(transactions, periodKey, monthStartDay)) {
    if (tx.type !== "expense") continue
    const day = tx.date.slice(0, 10)
    map.set(day, (map.get(day) ?? 0) + tx.amount)
  }

  return map
}

export function getCurrentPeriodKey(monthStartDay: number, now = new Date()) {
  return getPeriodKey(now, monthStartDay)
}
