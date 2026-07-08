import type { BudgetPlanState, Category, PeriodArchive, Transaction } from "./types"
import { getPeriodKey, getPeriodStartDate, isDateInPeriod } from "./period"

export const BUDGET_INCOME_TX_PREFIX = "budget-income-"

export function isBudgetIncomeTransaction(tx: Transaction) {
  return tx.type === "income" && tx.id.startsWith(BUDGET_INCOME_TX_PREFIX)
}

export function getPlannedIncomeTotal(budgetPlan?: BudgetPlanState) {
  if (!budgetPlan?.incomeSources?.length) return 0
  return budgetPlan.incomeSources.reduce((sum, entry) => sum + entry.amount, 0)
}

export function getPeriodIncome(
  transactions: Transaction[],
  budgetPlan: BudgetPlanState | undefined,
  periodKey: string,
  monthStartDay: number,
) {
  const periodTx = getPeriodTransactions(transactions, periodKey, monthStartDay)
  const manualIncome = periodTx
    .filter((tx) => tx.type === "income" && !isBudgetIncomeTransaction(tx))
    .reduce((sum, tx) => sum + tx.amount, 0)
  const budgetIncomeFromTx = periodTx
    .filter(isBudgetIncomeTransaction)
    .reduce((sum, tx) => sum + tx.amount, 0)
  const plannedIncome = getPlannedIncomeTotal(budgetPlan)

  if (budgetIncomeFromTx > 0) {
    return budgetIncomeFromTx + manualIncome
  }
  if (plannedIncome > 0) {
    return plannedIncome + manualIncome
  }
  return manualIncome
}

export function syncBudgetIncomeTransactions(
  transactions: Transaction[],
  incomeSources: BudgetPlanState["incomeSources"],
  periodKey: string,
  monthStartDay: number,
): Transaction[] {
  const withoutBudgetIncome = transactions.filter((tx) => !isBudgetIncomeTransaction(tx))
  const periodStart = getPeriodStartDate(periodKey, monthStartDay)
  const dateIso = periodStart.toISOString()

  const budgetIncomeTransactions: Transaction[] = incomeSources
    .filter((source) => source.amount > 0 && source.name.trim())
    .map((source) => ({
      id: `${BUDGET_INCOME_TX_PREFIX}${source.id}`,
      amount: source.amount,
      type: "income" as const,
      date: dateIso,
      categoryId: null,
      note: source.name.trim(),
    }))

  return [...withoutBudgetIncome, ...budgetIncomeTransactions]
}

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
  budgetPlan?: BudgetPlanState,
) {
  const periodTx = getPeriodTransactions(transactions, periodKey, monthStartDay)
  const income = getPeriodIncome(transactions, budgetPlan, periodKey, monthStartDay)
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
  options?: { includeExcluded?: boolean; budgetPlan?: BudgetPlanState },
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
    income: getPeriodIncome(transactions, options?.budgetPlan, periodKey, monthStartDay),
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
