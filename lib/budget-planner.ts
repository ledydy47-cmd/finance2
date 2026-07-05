import type { BudgetEntry, Category, CategoryKind } from "./types"

export function parseAmount(value: string): number {
  const n = Number(value.replace(/\s/g, "").replace(",", "."))
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : 0
}

export function sumEntries(entries: BudgetEntry[]) {
  return entries.reduce((sum, e) => sum + e.amount, 0)
}

export function computeBudgetTotals(
  incomeSources: BudgetEntry[],
  mandatoryExpenses: BudgetEntry[],
  categoryAllocations: Record<string, number>,
) {
  const incomeTotal = sumEntries(incomeSources)
  const mandatoryTotal = sumEntries(mandatoryExpenses)
  const categoriesTotal = Object.values(categoryAllocations).reduce((sum, v) => sum + v, 0)
  const remaining = incomeTotal - mandatoryTotal - categoriesTotal
  const dreamAmount = Math.max(0, remaining)
  const overspent = remaining < 0

  return {
    incomeTotal,
    mandatoryTotal,
    categoriesTotal,
    remaining,
    dreamAmount,
    overspent,
  }
}

export function createDefaultIncomeSources(): BudgetEntry[] {
  return [{ id: "income-salary", name: "Зарплата", amount: 72000 }]
}

export function createDefaultMandatoryExpenses(): BudgetEntry[] {
  return [
    { id: "cat-rent", name: "Аренда", amount: 0 },
    { id: "cat-utilities", name: "ЖКХ", amount: 0 },
  ]
}

const CATEGORY_PALETTE = [
  { tint: "oklch(0.93 0.06 40)", bar: "oklch(0.72 0.14 45)", icon: "Carrot" },
  { tint: "oklch(0.93 0.05 355)", bar: "oklch(0.72 0.13 355)", icon: "Coffee" },
  { tint: "oklch(0.93 0.06 160)", bar: "oklch(0.68 0.12 160)", icon: "Sparkles" },
  { tint: "oklch(0.92 0.05 280)", bar: "oklch(0.68 0.13 280)", icon: "Ticket" },
  { tint: "oklch(0.92 0.05 200)", bar: "oklch(0.68 0.12 210)", icon: "Bus" },
  { tint: "oklch(0.92 0.05 300)", bar: "oklch(0.68 0.13 300)", icon: "ShoppingBag" },
  { tint: "oklch(0.93 0.04 350)", bar: "oklch(0.78 0.115 355)", icon: "Heart" },
  { tint: "oklch(0.92 0.05 120)", bar: "oklch(0.68 0.12 140)", icon: "Home" },
]

export function paletteForIndex(index: number) {
  return CATEGORY_PALETTE[index % CATEGORY_PALETTE.length]
}

export function buildCategoryFromEntry(
  entry: BudgetEntry & Partial<CategoryDraftMeta>,
  kind: CategoryKind,
  existing?: Category,
  paletteIndex = 0,
): Category {
  const palette = paletteForIndex(paletteIndex)
  return {
    id: entry.id,
    name: entry.name,
    monthlyLimit: entry.amount,
    kind,
    icon: entry.icon ?? existing?.icon ?? palette.icon,
    iconImage: entry.iconImage ?? existing?.iconImage,
    tint: entry.tint ?? existing?.tint ?? palette.tint,
    bar: entry.bar ?? existing?.bar ?? palette.bar,
  }
}

export interface ApplyBudgetInput {
  incomeSources: BudgetEntry[]
  mandatoryExpenses: BudgetEntry[]
  flexibleCategories: FlexibleCategoryEntry[]
  goalContribution: number
}

export interface CategoryDraftMeta {
  icon: string
  iconImage?: string
  tint: string
  bar: string
}

export type FlexibleCategoryEntry = BudgetEntry & CategoryDraftMeta

export function buildCategoriesFromPlan(
  mandatoryExpenses: BudgetEntry[],
  flexibleCategories: BudgetEntry[],
  existingCategories: Category[],
): Category[] {
  const findExisting = (id: string) => existingCategories.find((c) => c.id === id)

  const mandatory = mandatoryExpenses.map((entry, i) =>
    buildCategoryFromEntry(entry, "mandatory", findExisting(entry.id), i),
  )

  const flexible = flexibleCategories.map((entry, i) =>
    buildCategoryFromEntry(entry, "flexible", findExisting(entry.id), i + mandatory.length),
  )

  return [...mandatory, ...flexible]
}

export function buildBudgetPlanState(input: ApplyBudgetInput): BudgetPlanState {
  return {
    incomeSources: input.incomeSources,
    mandatoryExpenses: input.mandatoryExpenses,
    flexibleCategoryIds: input.flexibleCategories.map((c) => c.id),
    categoryAllocations: Object.fromEntries(
      input.flexibleCategories.map((c) => [c.id, c.amount]),
    ),
  }
}

export function migrateLegacyBudgetPlan(
  plan: Record<string, unknown> | undefined,
  categories: Category[],
): BudgetPlanState | undefined {
  if (!plan) return undefined

  if (Array.isArray(plan.incomeSources)) {
    return plan as unknown as BudgetPlanState
  }

  const legacyIncome = typeof plan.plannedIncome === "number" ? plan.plannedIncome : 72000
  const legacyFixed = Array.isArray(plan.fixedExpenses)
    ? (plan.fixedExpenses as BudgetEntry[])
    : createDefaultMandatoryExpenses()
  const legacyAlloc =
    plan.categoryAllocations && typeof plan.categoryAllocations === "object"
      ? (plan.categoryAllocations as Record<string, number>)
      : {}

  const flexibleIds =
    Object.keys(legacyAlloc).length > 0
      ? Object.keys(legacyAlloc)
      : categories.filter((c) => c.kind === "flexible").map((c) => c.id)

  return {
    incomeSources: [{ id: "income-salary", name: "Зарплата", amount: legacyIncome }],
    mandatoryExpenses: legacyFixed,
    flexibleCategoryIds: flexibleIds,
    categoryAllocations: legacyAlloc,
  }
}
