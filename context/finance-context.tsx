"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import { buildBudgetPlanState, buildCategoriesFromPlan } from "@/lib/budget-planner"
import type { ApplyBudgetInput } from "@/lib/budget-planner"
import { buildArchive, getCurrentPeriodKey, getMonthlySummary } from "@/lib/calculations"
import { createDefaultData } from "@/lib/default-data"
import { getPeriodLabel, getPeriodLabelFromKey } from "@/lib/period"
import { loadAppData, saveAppData } from "@/lib/storage"
import { ensureTelegramSdk } from "@/lib/telegram"
import type { SubscriptionPlan } from "@/lib/subscription"
import { isSubscriptionActive } from "@/lib/subscription"
import type { ThemeId } from "@/lib/themes"
import { applyTheme, DEFAULT_THEME_ID } from "@/lib/themes"
import type {
  AppData,
  Category,
  Goal,
  Settings,
  TabId,
  Transaction,
  TransactionType,
} from "@/lib/types"

interface FinanceContextValue {
  data: AppData
  periodKey: string
  periodLabel: string
  summary: ReturnType<typeof getMonthlySummary>
  activeTab: TabId
  showAddTransaction: boolean
  addToGoalTargetId: string | null
  showBudgetPlanner: boolean
  showTransactionsList: boolean
  showPaywall: boolean
  isContentLocked: boolean
  setActiveTab: (tab: TabId) => void
  setShowAddTransaction: (open: boolean) => void
  setShowBudgetPlanner: (open: boolean) => void
  setShowTransactionsList: (open: boolean) => void
  openPaywall: () => void
  closePaywall: () => void
  activateSubscription: (input: {
    plan: SubscriptionPlan
    paymentId: string
    expiresAt: string
  }) => void
  restoreSubscription: () => Promise<{ ok: boolean; message: string }>
  openAddToGoal: (goalId: string) => void
  closeAddToGoal: () => void
  setPrimaryGoal: (goalId: string) => void
  getPrimaryGoal: () => Goal | undefined
  addTransaction: (input: {
    amount: number
    type: TransactionType
    categoryId: string | null
    note: string
    date?: string
  }) => void
  deleteTransaction: (id: string) => void
  addGoal: (input: Omit<Goal, "id" | "savedAmount">) => void
  updateGoal: (id: string, patch: Partial<Omit<Goal, "id">>) => void
  deleteGoal: (id: string) => void
  addToGoal: (id: string, amount: number) => void
  updateCategory: (id: string, patch: Partial<Omit<Category, "id">>) => void
  addCategory: (input: Omit<Category, "id">) => void
  deleteCategory: (id: string) => void
  updateSettings: (patch: Partial<Settings>) => void
  setTheme: (themeId: ThemeId) => void
  applyBudgetPlan: (input: ApplyBudgetInput) => void
  completeOnboarding: (input: {
    name: string
    age: number
    savingMotivation: string
    moneyProblem: string
    financeFeeling: string
    currency: "RUB"
    monthlySavings: number
  }) => void
  isHomeSetupActive: boolean
  homeSetupStep: 1 | 2 | 3
  showHomeGoalSetup: boolean
  setShowHomeGoalSetup: (open: boolean) => void
  skipHomeSetup: () => void
  completeHomeWalkthrough: () => void
  getCategoryById: (id: string | null) => Category | undefined
}

function isUserSubscribed(settings: Settings) {
  if (settings.subscriptionExpiresAt) {
    return isSubscriptionActive(settings.subscriptionExpiresAt)
  }
  return settings.isSubscribed
}

function archivePreviousPeriod(data: AppData, previousKey: string): AppData {
  if (data.archives.some((a) => a.periodKey === previousKey)) {
    return { ...data, lastPeriodKey: getCurrentPeriodKey(data.settings.monthStartDay) }
  }

  const label = getPeriodLabelFromKey(previousKey, data.settings.monthStartDay)
  const archive = buildArchive(
    data.transactions,
    data.categories,
    previousKey,
    data.settings.monthStartDay,
    label,
  )

  const hasActivity = archive.income > 0 || archive.spent > 0
  const archives = hasActivity ? [...data.archives, archive] : data.archives

  return {
    ...data,
    archives,
    lastPeriodKey: getCurrentPeriodKey(data.settings.monthStartDay),
  }
}

function syncPeriod(data: AppData): AppData {
  const currentKey = getCurrentPeriodKey(data.settings.monthStartDay)
  if (data.lastPeriodKey === currentKey) return data
  return archivePreviousPeriod(data, data.lastPeriodKey)
}

export function FinanceProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData>(createDefaultData)
  const [hydrated, setHydrated] = useState(false)
  const [activeTab, setActiveTab] = useState<TabId>("home")
  const [showAddTransaction, setShowAddTransactionState] = useState(false)
  const [addToGoalTargetId, setAddToGoalTargetId] = useState<string | null>(null)
  const [showBudgetPlanner, setShowBudgetPlannerState] = useState(false)
  const [showTransactionsList, setShowTransactionsList] = useState(false)
  const [showHomeGoalSetup, setShowHomeGoalSetup] = useState(false)
  const [showPaywall, setShowPaywall] = useState(false)

  useEffect(() => {
    let cancelled = false

    void ensureTelegramSdk().then(() => {
      if (cancelled) return
      const loaded = syncPeriod(loadAppData())
      const subscribed = isUserSubscribed(loaded.settings)
      if (loaded.settings.isSubscribed !== subscribed) {
        loaded.settings.isSubscribed = subscribed
      }
      setData(loaded)
      applyTheme(loaded.settings.themeId ?? DEFAULT_THEME_ID)
      setHydrated(true)
    })

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!hydrated) return
    saveAppData(data)
  }, [data, hydrated])

  const periodKey = getCurrentPeriodKey(data.settings.monthStartDay)
  const periodLabel = getPeriodLabel(new Date(), data.settings.monthStartDay)
  const summary = useMemo(
    () => getMonthlySummary(data.transactions, data.categories, periodKey, data.settings.monthStartDay),
    [data.transactions, data.categories, periodKey, data.settings.monthStartDay],
  )

  const isHomeSetupActive =
    data.settings.onboardingCompleted && !data.settings.homeWalkthroughCompleted

  const isContentLocked =
    data.settings.paywallShown && !isUserSubscribed(data.settings)

  const openPaywall = useCallback(() => setShowPaywall(true), [])
  const closePaywall = useCallback(() => setShowPaywall(false), [])

  const homeSetupStep = useMemo((): 1 | 2 | 3 => {
    if (!isHomeSetupActive) return 3
    if (data.goals.length === 0) return 1
    const flexCount = data.categories.filter((c) => c.kind === "flexible").length
    if (flexCount === 0) return 2
    return 3
  }, [isHomeSetupActive, data.goals.length, data.categories])

  const update = useCallback((updater: (prev: AppData) => AppData) => {
    setData((prev) => syncPeriod(updater(prev)))
  }, [])

  const activateSubscription = useCallback(
    (input: { plan: SubscriptionPlan; paymentId: string; expiresAt: string }) => {
      update((prev) => ({
        ...prev,
        settings: {
          ...prev.settings,
          isSubscribed: true,
          subscriptionPlan: input.plan,
          subscriptionExpiresAt: input.expiresAt,
          lastPaymentId: input.paymentId,
        },
      }))
      setShowPaywall(false)
    },
    [update],
  )

  const restoreSubscription = useCallback(async (): Promise<{ ok: boolean; message: string }> => {
    const paymentId = data.settings.lastPaymentId
    if (!paymentId) {
      return { ok: false, message: "Сохранённая покупка не найдена" }
    }

    try {
      const response = await fetch(
        `/api/payments/verify?paymentId=${encodeURIComponent(paymentId)}`,
      )
      const payload = await response.json()
      if (!response.ok || !payload.active) {
        return { ok: false, message: "Активная подписка не найдена" }
      }

      activateSubscription({
        plan: payload.plan,
        paymentId: payload.paymentId,
        expiresAt: payload.expiresAt,
      })
      return { ok: true, message: "Подписка восстановлена" }
    } catch {
      return { ok: false, message: "Не удалось проверить оплату" }
    }
  }, [activateSubscription, data.settings.lastPaymentId])

  const setShowAddTransaction = useCallback(
    (open: boolean) => {
      if (open && isContentLocked) {
        setShowPaywall(true)
        return
      }
      setShowAddTransactionState(open)
    },
    [isContentLocked],
  )

  const setShowBudgetPlanner = useCallback(
    (open: boolean) => {
      if (open && isContentLocked) {
        setShowPaywall(true)
        return
      }
      setShowBudgetPlannerState(open)
    },
    [isContentLocked],
  )

  const guardLocked = useCallback(() => {
    if (isContentLocked) {
      setShowPaywall(true)
      return true
    }
    return false
  }, [isContentLocked])

  const addTransaction = useCallback(
    (input: {
      amount: number
      type: TransactionType
      categoryId: string | null
      note: string
      date?: string
    }) => {
      if (isContentLocked) {
        setShowPaywall(true)
        return
      }

      const isFirstExpense =
        input.type === "expense" && !data.settings.firstExpenseAdded
      const shouldShowPaywall =
        isFirstExpense &&
        data.settings.homeWalkthroughCompleted &&
        !data.settings.paywallShown

      const tx: Transaction = {
        id: crypto.randomUUID(),
        amount: input.amount,
        type: input.type,
        date: input.date ?? new Date().toISOString(),
        categoryId: input.type === "expense" ? input.categoryId : null,
        note: input.note.trim(),
      }
      update((prev) => {
        const nextSettings = { ...prev.settings }
        if (isFirstExpense) {
          nextSettings.firstExpenseAdded = true
        }
        if (shouldShowPaywall) {
          nextSettings.paywallShown = true
        }
        return {
          ...prev,
          transactions: [tx, ...prev.transactions],
          settings: nextSettings,
        }
      })
      setShowAddTransactionState(false)
      setActiveTab("home")

      if (shouldShowPaywall) {
        setShowPaywall(true)
      }
    },
    [data.settings, isContentLocked, update],
  )

  const deleteTransaction = useCallback(
    (id: string) => {
      if (guardLocked()) return
      update((prev) => ({
        ...prev,
        transactions: prev.transactions.filter((tx) => tx.id !== id),
      }))
    },
    [guardLocked, update],
  )

  const addGoal = useCallback(
    (input: Omit<Goal, "id" | "savedAmount">) => {
      if (guardLocked()) return
      const goal: Goal = { ...input, id: crypto.randomUUID(), savedAmount: 0 }
      update((prev) => ({
        ...prev,
        goals: [...prev.goals, goal],
        settings: {
          ...prev.settings,
          primaryGoalId: prev.settings.primaryGoalId ?? goal.id,
        },
      }))
    },
    [guardLocked, update],
  )

  const updateGoal = useCallback(
    (id: string, patch: Partial<Omit<Goal, "id">>) => {
      if (guardLocked()) return
      update((prev) => ({
        ...prev,
        goals: prev.goals.map((g) => (g.id === id ? { ...g, ...patch } : g)),
      }))
    },
    [guardLocked, update],
  )

  const deleteGoal = useCallback(
    (id: string) => {
      if (guardLocked()) return
      update((prev) => {
        const goals = prev.goals.filter((g) => g.id !== id)
        const primaryGoalId =
          prev.settings.primaryGoalId === id
            ? (goals[0]?.id ?? null)
            : prev.settings.primaryGoalId
        return {
          ...prev,
          goals,
          settings: { ...prev.settings, primaryGoalId },
        }
      })
    },
    [guardLocked, update],
  )

  const addToGoal = useCallback(
    (id: string, amount: number) => {
      if (guardLocked()) return
      update((prev) => ({
        ...prev,
        goals: prev.goals.map((g) =>
          g.id === id ? { ...g, savedAmount: Math.min(g.targetAmount, g.savedAmount + amount) } : g,
        ),
      }))
    },
    [guardLocked, update],
  )

  const updateCategory = useCallback(
    (id: string, patch: Partial<Omit<Category, "id">>) => {
      if (guardLocked()) return
      update((prev) => ({
        ...prev,
        categories: prev.categories.map((c) => (c.id === id ? { ...c, ...patch } : c)),
      }))
    },
    [guardLocked, update],
  )

  const addCategory = useCallback(
    (input: Omit<Category, "id">) => {
      if (guardLocked()) return
      const category: Category = { ...input, id: crypto.randomUUID(), kind: input.kind ?? "flexible" }
      update((prev) => ({ ...prev, categories: [...prev.categories, category] }))
    },
    [guardLocked, update],
  )

  const deleteCategory = useCallback(
    (id: string) => {
      if (guardLocked()) return
      update((prev) => ({
        ...prev,
        categories: prev.categories.filter((c) => c.id !== id),
        transactions: prev.transactions.map((tx) =>
          tx.categoryId === id ? { ...tx, categoryId: null } : tx,
        ),
      }))
    },
    [guardLocked, update],
  )

  const updateSettings = useCallback(
    (patch: Partial<Settings>) => {
      update((prev) => ({ ...prev, settings: { ...prev.settings, ...patch } }))
    },
    [update],
  )

  const setTheme = useCallback(
    (themeId: ThemeId) => {
      updateSettings({ themeId })
    },
    [updateSettings],
  )

  const getCategoryById = useCallback(
    (id: string | null) => (id ? data.categories.find((c) => c.id === id) : undefined),
    [data.categories],
  )

  const openAddToGoal = useCallback(
    (goalId: string) => {
      if (guardLocked()) return
      setAddToGoalTargetId(goalId)
    },
    [guardLocked],
  )

  const closeAddToGoal = useCallback(() => {
    setAddToGoalTargetId(null)
  }, [])

  const setPrimaryGoal = useCallback(
    (goalId: string) => {
      if (guardLocked()) return
      update((prev) => ({
        ...prev,
        settings: { ...prev.settings, primaryGoalId: goalId },
      }))
    },
    [guardLocked, update],
  )

  const getPrimaryGoal = useCallback(() => {
    const { primaryGoalId } = data.settings
    if (primaryGoalId) {
      const goal = data.goals.find((g) => g.id === primaryGoalId)
      if (goal) return goal
    }
    return data.goals[0]
  }, [data.goals, data.settings])

  const applyBudgetPlan = useCallback(
    (input: ApplyBudgetInput) => {
      if (guardLocked()) return
      const primaryGoalId = data.settings.primaryGoalId ?? data.goals[0]?.id
      const plan = buildBudgetPlanState(input)
      const nextCategories = buildCategoriesFromPlan(
        input.mandatoryExpenses,
        input.flexibleCategories,
        data.categories,
      )
      const nextCategoryIds = new Set(nextCategories.map((c) => c.id))

      update((prev) => ({
        ...prev,
        budgetPlan: plan,
        categories: nextCategories,
        transactions: prev.transactions.map((tx) =>
          tx.categoryId && !nextCategoryIds.has(tx.categoryId)
            ? { ...tx, categoryId: null }
            : tx,
        ),
        goals: prev.goals.map((goal) =>
          goal.id === primaryGoalId
            ? { ...goal, monthlyContribution: input.goalContribution }
            : goal,
        ),
      }))
      setShowBudgetPlannerState(false)
      setActiveTab("home")
    },
    [data.categories, data.settings.primaryGoalId, data.goals, guardLocked, update],
  )

  const completeOnboarding = useCallback(
    (input: {
      name: string
      age: number
      savingMotivation: string
      moneyProblem: string
      financeFeeling: string
      currency: "RUB"
      monthlySavings: number
    }) => {
      update((prev) => ({
        ...prev,
        goals: [],
        categories: [],
        transactions: [],
        budgetPlan: undefined,
        settings: {
          ...prev.settings,
          userName: input.name,
          currency: input.currency,
          age: input.age,
          savingMotivation: input.savingMotivation,
          moneyProblem: input.moneyProblem,
          financeFeeling: input.financeFeeling,
          onboardingCompleted: true,
          primaryGoalId: null,
          homeWalkthroughCompleted: false,
          firstExpenseAdded: false,
          paywallShown: false,
          isSubscribed: false,
        },
      }))
      setActiveTab("home")
    },
    [update, setActiveTab],
  )

  const skipHomeSetup = useCallback(() => {
    update((prev) => ({
      ...prev,
      settings: {
        ...prev.settings,
        homeWalkthroughCompleted: true,
      },
    }))
    setShowHomeGoalSetup(false)
  }, [update])

  const completeHomeWalkthrough = useCallback(() => {
    update((prev) => ({
      ...prev,
      settings: {
        ...prev.settings,
        homeWalkthroughCompleted: true,
      },
    }))
  }, [update])

  const value: FinanceContextValue = {
    data,
    periodKey,
    periodLabel,
    summary,
    activeTab,
    showAddTransaction,
    addToGoalTargetId,
    showBudgetPlanner,
    showTransactionsList,
    showPaywall,
    isContentLocked,
    setActiveTab,
    setShowAddTransaction,
    setShowBudgetPlanner,
    setShowTransactionsList,
    openPaywall,
    closePaywall,
    activateSubscription,
    restoreSubscription,
    openAddToGoal,
    closeAddToGoal,
    setPrimaryGoal,
    getPrimaryGoal,
    addTransaction,
    deleteTransaction,
    addGoal,
    updateGoal,
    deleteGoal,
    addToGoal,
    updateCategory,
    addCategory,
    deleteCategory,
    updateSettings,
    setTheme,
    applyBudgetPlan,
    completeOnboarding,
    isHomeSetupActive,
    homeSetupStep,
    showHomeGoalSetup,
    setShowHomeGoalSetup,
    skipHomeSetup,
    completeHomeWalkthrough,
    getCategoryById,
  }

  if (!hydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="font-serif text-lg text-muted-foreground">Загрузка…</p>
      </div>
    )
  }

  return <FinanceContext.Provider value={value}>{children}</FinanceContext.Provider>
}

export function useFinance() {
  const ctx = useContext(FinanceContext)
  if (!ctx) throw new Error("useFinance must be used within FinanceProvider")
  return ctx
}
