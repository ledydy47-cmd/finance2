import type { ThemeId } from "@/lib/themes"

export type TransactionType = "expense" | "income"

export type CategoryKind = "mandatory" | "flexible"

export interface Transaction {
  id: string
  amount: number
  type: TransactionType
  date: string
  categoryId: string | null
  note: string
}

export interface Category {
  id: string
  name: string
  icon: string
  iconImage?: string
  tint: string
  bar: string
  monthlyLimit: number
  kind: CategoryKind
}

export interface Goal {
  id: string
  name: string
  targetAmount: number
  savedAmount: number
  image: string
  monthlyContribution?: number
}

export interface BudgetEntry {
  id: string
  name: string
  amount: number
}

export interface BudgetPlanState {
  incomeSources: BudgetEntry[]
  mandatoryExpenses: BudgetEntry[]
  flexibleCategoryIds: string[]
  categoryAllocations: Record<string, number>
}

export interface Settings {
  userName: string
  currency: "RUB"
  monthStartDay: number
  primaryGoalId: string | null
  themeId: ThemeId
  onboardingCompleted: boolean
  homeWalkthroughCompleted: boolean
  firstExpenseAdded: boolean
  paywallShown: boolean
  isSubscribed: boolean
  age?: number
  savingMotivation?: string
  moneyProblem?: string
  financeFeeling?: string
}

export interface PeriodArchive {
  periodKey: string
  label: string
  income: number
  spent: number
  categorySpent: Record<string, number>
  categoryBudget: Record<string, number>
}

export interface AppData {
  transactions: Transaction[]
  categories: Category[]
  goals: Goal[]
  settings: Settings
  archives: PeriodArchive[]
  lastPeriodKey: string
  budgetPlan?: BudgetPlanState
}

export type TabId = "home" | "stats" | "goals" | "analytics" | "settings"

/** @deprecated use BudgetEntry */
export type FixedExpense = BudgetEntry
