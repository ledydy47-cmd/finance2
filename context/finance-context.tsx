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
import { getCurrentPeriodKey, getMonthlySummary } from "@/lib/calculations"
import { createDefaultData } from "@/lib/default-data"
import { getActiveGoals, shouldCelebrateGoal } from "@/lib/goals"
import { getPeriodLabel } from "@/lib/period"
import {
  acknowledgeNewMonthLater,
  applyNewMonthReset,
  isNewPeriodPending,
  resetCurrentMonthSpending,
} from "@/lib/period-reset"
import { loadAppData, saveAppData } from "@/lib/storage"
import { getClientUserKey } from "@/lib/client-id"
import { ensureTelegramSdk, getWebApp, waitForTelegramWebApp } from "@/lib/telegram"
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
  addTransactionDraft: { categoryId: string; type: TransactionType } | null
  addToGoalTargetId: string | null
  showBudgetPlanner: boolean
  showTransactionsList: boolean
  showPaywall: boolean
  showNewMonthModal: boolean
  celebratingGoal: Goal | null
  showCreateGoalPrompt: boolean
  showGoalCreateForm: boolean
  isContentLocked: boolean
  setActiveTab: (tab: TabId) => void
  setShowAddTransaction: (open: boolean) => void
  openAddTransactionForCategory: (categoryId: string) => void
  setShowBudgetPlanner: (open: boolean) => void
  setShowTransactionsList: (open: boolean) => void
  openPaywall: () => void
  closePaywall: () => void
  activateSubscription: (input: {
    plan: SubscriptionPlan
    paymentId: string
    expiresAt: string
    autoRenew?: boolean
    subscriptionStatus?: Settings["subscriptionStatus"]
  }) => void
  restoreSubscription: () => Promise<{ ok: boolean; message: string }>
  syncSubscriptionFromServer: (userKey: string) => Promise<void>
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
  confirmNewMonthReset: () => void
  dismissNewMonthUntilLater: () => void
  resetMonthSpendingManual: () => void
  dismissGoalCelebration: () => void
  openCreateGoalFlow: () => void
  dismissCreateGoalPrompt: () => void
  setShowGoalCreateForm: (open: boolean) => void
  getCategoryById: (id: string | null) => Category | undefined
}

const FinanceContext = createContext<FinanceContextValue | null>(null)

function isUserSubscribed(settings: Settings) {
  if (settings.subscriptionExpiresAt) {
    return isSubscriptionActive(settings.subscriptionExpiresAt)
  }
  return settings.isSubscribed
}

function markGoalCelebrated(data: AppData, goalId: string): AppData {
  const goals = data.goals.map((g) =>
    g.id === goalId
      ? {
          ...g,
          savedAmount: Math.max(g.savedAmount, g.targetAmount),
          completed: true,
          completedAt: g.completedAt ?? new Date().toISOString(),
          completionCelebrated: true,
        }
      : g,
  )
  const activeGoals = getActiveGoals(goals)
  const primaryGoalId =
    data.settings.primaryGoalId === goalId
      ? (activeGoals[0]?.id ?? null)
      : data.settings.primaryGoalId

  return {
    ...data,
    goals,
    settings: { ...data.settings, primaryGoalId },
  }
}

function findGoalToCelebrate(data: AppData): Goal | undefined {
  return data.goals.find((g) => shouldCelebrateGoal(g))
}

export function FinanceProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData>(createDefaultData)
  const [hydrated, setHydrated] = useState(false)
  const [activeTab, setActiveTab] = useState<TabId>("home")
  const [showAddTransaction, setShowAddTransactionState] = useState(false)
  const [addTransactionDraft, setAddTransactionDraft] = useState<{
    categoryId: string
    type: TransactionType
  } | null>(null)
  const [addToGoalTargetId, setAddToGoalTargetId] = useState<string | null>(null)
  const [showBudgetPlanner, setShowBudgetPlannerState] = useState(false)
  const [showTransactionsList, setShowTransactionsList] = useState(false)
  const [showHomeGoalSetup, setShowHomeGoalSetup] = useState(false)
  const [showPaywall, setShowPaywall] = useState(false)
  const [showNewMonthModal, setShowNewMonthModal] = useState(false)
  const [celebratingGoal, setCelebratingGoal] = useState<Goal | null>(null)
  const [showCreateGoalPrompt, setShowCreateGoalPrompt] = useState(false)
  const [showGoalCreateForm, setShowGoalCreateFormState] = useState(false)

  useEffect(() => {
    let cancelled = false

    const finishHydration = () => {
      if (cancelled) return
      const loaded = loadAppData()
      const subscribed = isUserSubscribed(loaded.settings)
      if (loaded.settings.isSubscribed !== subscribed) {
        loaded.settings.isSubscribed = subscribed
      }
      setData(loaded)
      applyTheme(loaded.settings.themeId ?? DEFAULT_THEME_ID)
      if (isNewPeriodPending(loaded)) {
        setShowNewMonthModal(true)
      }
      const goalToCelebrate = findGoalToCelebrate(loaded)
      if (goalToCelebrate) {
        setCelebratingGoal(goalToCelebrate)
      }
      setHydrated(true)
    }

    const timeoutId = window.setTimeout(finishHydration, 1500)

    void waitForTelegramWebApp(1500)
      .then(() => ensureTelegramSdk())
      .catch(() => undefined)
      .finally(() => {
        window.clearTimeout(timeoutId)
        finishHydration()
      })

    return () => {
      cancelled = true
      window.clearTimeout(timeoutId)
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

  const requiresPremiumAfterWalkthrough =
    data.settings.homeWalkthroughCompleted && !isUserSubscribed(data.settings)

  const openPaywall = useCallback(() => setShowPaywall(true), [])
  const closePaywall = useCallback(() => setShowPaywall(false), [])

  const homeSetupStep = useMemo((): 1 | 2 | 3 => {
    if (!isHomeSetupActive) return 3
    const activeGoals = getActiveGoals(data.goals)
    if (activeGoals.length === 0) return 1
    const flexCount = data.categories.filter((c) => c.kind === "flexible").length
    if (flexCount === 0) return 2
    return 3
  }, [isHomeSetupActive, data.goals.length, data.categories])

  const update = useCallback((updater: (prev: AppData) => AppData) => {
    setData((prev) => updater(prev))
  }, [])

  const activateSubscription = useCallback(
    (input: {
      plan: SubscriptionPlan
      paymentId: string
      expiresAt: string
      autoRenew?: boolean
      subscriptionStatus?: Settings["subscriptionStatus"]
    }) => {
      update((prev) => ({
        ...prev,
        settings: {
          ...prev.settings,
          isSubscribed: true,
          subscriptionPlan: input.plan,
          subscriptionExpiresAt: input.expiresAt,
          lastPaymentId: input.paymentId,
          autoRenew: input.autoRenew ?? true,
          subscriptionStatus: input.subscriptionStatus ?? "active",
        },
      }))
      setShowPaywall(false)
    },
    [update],
  )

  const syncSubscriptionFromServer = useCallback(
    async (userKey: string) => {
      try {
        const response = await fetch(
          `/api/subscription/status?userKey=${encodeURIComponent(userKey)}`,
        )
        const payload = await response.json()
        const subscription = payload.subscription
        if (!subscription) return

        update((prev) => ({
          ...prev,
          settings: {
            ...prev.settings,
            isSubscribed: subscription.active,
            subscriptionPlan: subscription.subscriptionType,
            subscriptionExpiresAt: subscription.currentPeriodEnd,
            autoRenew: subscription.autoRenew,
            subscriptionStatus: subscription.status,
            ...(subscription.lastPaymentId
              ? { lastPaymentId: subscription.lastPaymentId }
              : {}),
          },
        }))
      } catch {
        // ignore sync errors in UI
      }
    },
    [update],
  )

  const restoreSubscription = useCallback(async (): Promise<{ ok: boolean; message: string }> => {
    const userKey = getClientUserKey(getWebApp()?.initDataUnsafe?.user?.id)

    try {
      const statusResponse = await fetch(
        `/api/subscription/status?userKey=${encodeURIComponent(userKey)}`,
      )
      const statusPayload = await statusResponse.json()
      const subscription = statusPayload.subscription

      if (subscription?.active) {
        activateSubscription({
          plan: subscription.subscriptionType,
          paymentId: subscription.lastPaymentId ?? data.settings.lastPaymentId ?? "restored",
          expiresAt: subscription.currentPeriodEnd,
          autoRenew: subscription.autoRenew ?? true,
          subscriptionStatus: subscription.status ?? "active",
        })
        return { ok: true, message: "Подписка восстановлена" }
      }
    } catch {
      // fall through to payment verification
    }

    const paymentId = data.settings.lastPaymentId
    if (!paymentId) {
      return { ok: false, message: "Активная подписка не найдена" }
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
        autoRenew: payload.autoRenew ?? true,
        subscriptionStatus: payload.status ?? "active",
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
      if (!open) {
        setAddTransactionDraft(null)
      }
      setShowAddTransactionState(open)
    },
    [isContentLocked],
  )

  const openAddTransactionForCategory = useCallback(
    (categoryId: string) => {
      if (isContentLocked) {
        setShowPaywall(true)
        return
      }
      setAddTransactionDraft({ categoryId, type: "expense" })
      setShowAddTransactionState(true)
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

  const guardPremiumGoalCreation = useCallback(() => {
    if (
      requiresPremiumAfterWalkthrough &&
      getActiveGoals(data.goals).length >= 1
    ) {
      setShowPaywall(true)
      return true
    }
    return false
  }, [data.goals, requiresPremiumAfterWalkthrough])

  const guardPremiumGoalEdit = useCallback(() => {
    if (requiresPremiumAfterWalkthrough) {
      setShowPaywall(true)
      return true
    }
    return false
  }, [requiresPremiumAfterWalkthrough])

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
      if (guardPremiumGoalCreation()) return
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
    [guardLocked, guardPremiumGoalCreation, update],
  )

  const updateGoal = useCallback(
    (id: string, patch: Partial<Omit<Goal, "id">>) => {
      if (guardPremiumGoalEdit()) return
      if (guardLocked()) return
      update((prev) => ({
        ...prev,
        goals: prev.goals.map((g) => (g.id === id ? { ...g, ...patch } : g)),
      }))
    },
    [guardLocked, guardPremiumGoalEdit, update],
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
      update((prev) => {
        const goals = prev.goals.map((g) =>
          g.id === id ? { ...g, savedAmount: g.savedAmount + amount } : g,
        )
        return { ...prev, goals }
      })
      setAddToGoalTargetId(null)

      const goal = data.goals.find((g) => g.id === id)
      if (goal && goal.savedAmount + amount >= goal.targetAmount && !goal.completionCelebrated) {
        setCelebratingGoal({
          ...goal,
          savedAmount: goal.savedAmount + amount,
        })
      }
    },
    [data.goals, guardLocked, update],
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
    const activeGoals = getActiveGoals(data.goals)
    const { primaryGoalId } = data.settings
    if (primaryGoalId) {
      const goal = activeGoals.find((g) => g.id === primaryGoalId)
      if (goal) return goal
    }
    return activeGoals[0]
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

  const confirmNewMonthReset = useCallback(() => {
    update((prev) => applyNewMonthReset(prev))
    setShowNewMonthModal(false)
  }, [update])

  const dismissNewMonthUntilLater = useCallback(() => {
    update((prev) => acknowledgeNewMonthLater(prev))
    setShowNewMonthModal(false)
  }, [update])

  const resetMonthSpendingManual = useCallback(() => {
    update((prev) => resetCurrentMonthSpending(prev))
  }, [update])

  const dismissGoalCelebration = useCallback(() => {
    if (celebratingGoal) {
      update((prev) => markGoalCelebrated(prev, celebratingGoal.id))
    }
    setCelebratingGoal(null)
    setShowCreateGoalPrompt(true)
  }, [celebratingGoal, update])

  const setShowGoalCreateForm = useCallback(
    (open: boolean) => {
      if (open && guardPremiumGoalCreation()) return
      setShowGoalCreateFormState(open)
    },
    [guardPremiumGoalCreation],
  )

  const openCreateGoalFlow = useCallback(() => {
    if (guardPremiumGoalCreation()) return
    setShowCreateGoalPrompt(false)
    setShowGoalCreateForm(true)
    setActiveTab("goals")
  }, [guardPremiumGoalCreation, setShowGoalCreateForm])

  const dismissCreateGoalPrompt = useCallback(() => {
    setShowCreateGoalPrompt(false)
  }, [])

  const value: FinanceContextValue = {
    data,
    periodKey,
    periodLabel,
    summary,
    activeTab,
    showAddTransaction,
    addTransactionDraft,
    addToGoalTargetId,
    showBudgetPlanner,
    showTransactionsList,
    showPaywall,
    showNewMonthModal,
    celebratingGoal,
    showCreateGoalPrompt,
    showGoalCreateForm,
    isContentLocked,
    setActiveTab,
    setShowAddTransaction,
    openAddTransactionForCategory,
    setShowBudgetPlanner,
    setShowTransactionsList,
    openPaywall,
    closePaywall,
    activateSubscription,
    restoreSubscription,
    syncSubscriptionFromServer,
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
    confirmNewMonthReset,
    dismissNewMonthUntilLater,
    resetMonthSpendingManual,
    dismissGoalCelebration,
    openCreateGoalFlow,
    dismissCreateGoalPrompt,
    setShowGoalCreateForm,
    getCategoryById,
  }

  return <FinanceContext.Provider value={value}>{children}</FinanceContext.Provider>
}

export function useFinance() {
  const ctx = useContext(FinanceContext)
  if (!ctx) throw new Error("useFinance must be used within FinanceProvider")
  return ctx
}
