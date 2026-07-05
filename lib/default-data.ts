import type { AppData } from "./types"
import { getCurrentPeriodKey } from "./calculations"
import { DEFAULT_THEME_ID } from "./themes"
import {
  buildCategoriesFromPlan,
  createDefaultIncomeSources,
  createDefaultMandatoryExpenses,
} from "./budget-planner"

const today = new Date()
const yesterday = new Date(today)
yesterday.setDate(yesterday.getDate() - 1)

function iso(date: Date) {
  return date.toISOString()
}

export function createDefaultData(): AppData {
  const incomeSources = createDefaultIncomeSources()
  const mandatoryExpenses = createDefaultMandatoryExpenses()
  const flexibleCategories = [
    {
      id: "cat-products",
      name: "Продукты",
      amount: 14000,
    },
    {
      id: "cat-cafe",
      name: "Кафе и доставка",
      amount: 8500,
    },
    {
      id: "cat-beauty",
      name: "Косметика",
      amount: 5500,
    },
    {
      id: "cat-entertainment",
      name: "Развлечения",
      amount: 4000,
    },
    {
      id: "cat-transport",
      name: "Транспорт",
      amount: 3000,
    },
  ]

  const categories = buildCategoriesFromPlan(mandatoryExpenses, flexibleCategories, [
    {
      id: "cat-products",
      name: "Продукты",
      icon: "🛒",
      tint: "oklch(0.93 0.06 40)",
      bar: "oklch(0.72 0.14 45)",
      monthlyLimit: 14000,
      kind: "flexible",
    },
    {
      id: "cat-cafe",
      name: "Кафе и доставка",
      icon: "☕",
      tint: "oklch(0.93 0.05 355)",
      bar: "oklch(0.72 0.13 355)",
      monthlyLimit: 8500,
      kind: "flexible",
    },
    {
      id: "cat-beauty",
      name: "Косметика",
      icon: "💄",
      tint: "oklch(0.93 0.06 160)",
      bar: "oklch(0.68 0.12 160)",
      monthlyLimit: 5500,
      kind: "flexible",
    },
    {
      id: "cat-entertainment",
      name: "Развлечения",
      icon: "🎬",
      tint: "oklch(0.92 0.05 280)",
      bar: "oklch(0.68 0.13 280)",
      monthlyLimit: 4000,
      kind: "flexible",
    },
    {
      id: "cat-transport",
      name: "Транспорт",
      icon: "🚌",
      tint: "oklch(0.92 0.05 200)",
      bar: "oklch(0.68 0.12 210)",
      monthlyLimit: 3000,
      kind: "flexible",
    },
  ])

  const transactions = [
    {
      id: "tx-income-1",
      amount: 72000,
      type: "income" as const,
      date: iso(new Date(today.getFullYear(), today.getMonth(), 1, 10, 0, 0)),
      categoryId: null,
      note: "Зарплата",
    },
    {
      id: "tx-1",
      amount: 420,
      type: "expense" as const,
      date: iso(today),
      categoryId: "cat-cafe",
      note: "Кофейня «Утро»",
    },
    {
      id: "tx-2",
      amount: 1860,
      type: "expense" as const,
      date: iso(today),
      categoryId: "cat-products",
      note: "Пятёрочка",
    },
    {
      id: "tx-3",
      amount: 3290,
      type: "expense" as const,
      date: iso(yesterday),
      categoryId: "cat-market",
      note: "Wildberries",
    },
  ]

  return {
    transactions,
    categories,
    goals: [
      {
        id: "goal-sochi",
        name: "Поездка в Сочи ✈️",
        targetAmount: 80000,
        savedAmount: 15000,
        image: "/images/goal-sochi.png",
        monthlyContribution: 5000,
      },
    ],
    settings: {
      userName: "",
      currency: "RUB",
      monthStartDay: 1,
      primaryGoalId: "goal-sochi",
      themeId: DEFAULT_THEME_ID,
      onboardingCompleted: false,
      homeWalkthroughCompleted: false,
      firstExpenseAdded: false,
      paywallShown: false,
      isSubscribed: false,
      autoRenew: true,
      subscriptionStatus: undefined,
    },
    archives: [],
    lastPeriodKey: getCurrentPeriodKey(1),
    budgetPlan: {
      incomeSources,
      mandatoryExpenses,
      flexibleCategoryIds: flexibleCategories.map((c) => c.id),
      categoryAllocations: Object.fromEntries(flexibleCategories.map((c) => [c.id, c.amount])),
    },
  }
}
