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
import { getCurrentPeriodKey, getMonthlySummary, syncBudgetIncomeTransactions } from "@/lib/calculations"
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
import {
  fetchUserProgress,
  mergeServerProgressIntoAppData,
} from "@/lib/user-progress-client"
import {
  applyRemoteAppReset,
  fetchPendingAppReset,
  markResetApplied,
} from "@/lib/app-reset-client"
import { trackClientAnalytics } from "@/lib/analytics-client"
import { getClientUserKey } from "@/lib/client-id"
import { scheduleFlashSaleReminderChecks } from "@/lib/client/flash-sale-reminder-client"
import {
  canActivatePaywall,
  hasFreemiumTrialCompleted,
  isAddingSecondExpenseAttempt,
  resolvePaywallAccess,
  shouldStartFlashSaleTimer,
} from "@/lib/paywall-experiment"
import { ensureTelegramSdk, getWebApp, waitForTelegramWebApp } from "@/lib/telegram"
import type { SubscriptionPlan } from "@/lib/subscription"
import { isSubscriptionActive, PENDING_PAYMENT_STORAGE_KEY } from "@/lib/subscription"
import { verifyPaymentWithRetry } from "@/lib/pending-payment-verify"
import { fetchServerFlashSaleStatus, fetchServerSubscriptionSettings } from "@/lib/subscription-sync-client"
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
  hydrated: boolean
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
  confirmPendingPayment: () => Promise<boolean>
  syncSubscriptionFromServer: (userKey: string) => Promise<boolean>
  syncFlashSaleFromServer: (userKey: string) => Promise<boolean>
  activatePendingFlashSaleOffer: (userKey: string) => Promise<boolean>
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

function hydrationTimeout(ms: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms)
  })
}

async function syncHydrationFromServer(input: {
  userKey: string
  loaded: AppData
  appliedOnboardingReset: boolean
}) {
  let loaded = input.loaded

  const pendingReset = await fetchPendingAppReset(input.userKey)
  if (pendingReset) {
    loaded = applyRemoteAppReset(loaded, pendingReset)
    markResetApplied(pendingReset.resetId)
    saveAppData(loaded)
    if (pendingReset.resetToOnboarding) {
      return { loaded, appliedOnboardingReset: true }
    }
  }

  if (!input.appliedOnboardingReset) {
    const progress = await fetchUserProgress(input.userKey)
    if (progress) {
      loaded = mergeServerProgressIntoAppData(loaded, progress)
    }
  }

  const subscriptionPatch = await fetchServerSubscriptionSettings(input.userKey)
  if (subscriptionPatch) {
    loaded = {
      ...loaded,
      settings: { ...loaded.settings, ...subscriptionPatch },
    }
  }

  const flashSalePatch = await fetchServerFlashSaleStatus(input.userKey)
  if (
    flashSalePatch &&
    !isUserSubscribed(loaded.settings) &&
    hasFreemiumTrialCompleted(loaded.settings)
  ) {
    loaded = {
      ...loaded,
      settings: {
        ...loaded.settings,
        paywallFlashSaleStartedAt: flashSalePatch.startedAt,
        flashSaleDurationMs: flashSalePatch.saleDurationMs,
      },
    }
  }

  return { loaded, appliedOnboardingReset: input.appliedOnboardingReset }
}

function isUserSubscribed(settings: Settings) {
  if (settings.isSubscribed) return true
  if (settings.subscriptionExpiresAt) {
    return isSubscriptionActive(settings.subscriptionExpiresAt)
  }
  return false
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
    const safetyTimer = window.setTimeout(() => {
      if (!cancelled) setHydrated(true)
    }, 8000)

    const finishHydration = async () => {
      let loaded = createDefaultData()

      try {
        await waitForTelegramWebApp(5000)
        if (cancelled) return

        await ensureTelegramSdk().catch(() => undefined)
        if (cancelled) return

        loaded = loadAppData()
        const webAppUser = getWebApp()?.initDataUnsafe?.user
        const userKey = getClientUserKey(webAppUser?.id)

        if (userKey.startsWith("tg-")) {
          try {
            const synced = await Promise.race([
              syncHydrationFromServer({
                userKey,
                loaded,
                appliedOnboardingReset: false,
              }),
              hydrationTimeout(5000).then(() => ({
                loaded,
                appliedOnboardingReset: false,
              })),
            ])
            loaded = synced.loaded
          } catch {
            // keep local data if remote sync fails
          }
        } else {
          try {
            const pendingReset = await fetchPendingAppReset(userKey)
            if (pendingReset) {
              loaded = applyRemoteAppReset(loaded, pendingReset)
              markResetApplied(pendingReset.resetId)
              saveAppData(loaded)
            }
          } catch {
            // ignore remote reset errors
          }
        }

        if (loaded.settings.isSubscribed !== isUserSubscribed(loaded.settings)) {
          loaded.settings.isSubscribed = isUserSubscribed(loaded.settings)
        }
      } catch (error) {
        console.error("[finance] hydration failed", error)
        loaded = loadAppData()
      }

      if (cancelled) return

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
      window.clearTimeout(safetyTimer)
    }

    void finishHydration()

    return () => {
      cancelled = true
      window.clearTimeout(safetyTimer)
    }
  }, [])

  useEffect(() => {
    if (!hydrated) return
    saveAppData(data)
  }, [data, hydrated])

  useEffect(() => {
    if (!hydrated) return
    if (isUserSubscribed(data.settings)) {
      setShowPaywall(false)
    }
  }, [
    hydrated,
    data.settings.isSubscribed,
    data.settings.subscriptionExpiresAt,
  ])

  const periodKey = getCurrentPeriodKey(data.settings.monthStartDay)
  const periodLabel = getPeriodLabel(new Date(), data.settings.monthStartDay)
  const summary = useMemo(
    () =>
      getMonthlySummary(
        data.transactions,
        data.categories,
        periodKey,
        data.settings.monthStartDay,
        data.budgetPlan,
      ),
    [data.transactions, data.categories, data.budgetPlan, periodKey, data.settings.monthStartDay],
  )

  const isHomeSetupActive =
    data.settings.onboardingCompleted && !data.settings.homeWalkthroughCompleted

  const update = useCallback((updater: (prev: AppData) => AppData) => {
    setData((prev) => updater(prev))
  }, [])

  const telegramUserId = getWebApp()?.initDataUnsafe?.user?.id
  const paywallAccess = useMemo(
    () => resolvePaywallAccess(data.settings),
    [data.settings],
  )
  const isContentLocked = paywallAccess.isContentLocked
  const requiresPremiumAfterWalkthrough = paywallAccess.requiresPremiumAfterWalkthrough

  const persistFlashSaleStart = useCallback(
    (startedAt: string, durationMs?: number | null) => {
      update((prev) => ({
        ...prev,
        settings: {
          ...prev.settings,
          paywallFlashSaleStartedAt: startedAt,
          ...(durationMs ? { flashSaleDurationMs: durationMs } : {}),
        },
      }))

      const userKey = getClientUserKey(telegramUserId)
      scheduleFlashSaleReminderChecks(userKey, startedAt)

      void fetch("/api/subscription/flash-sale-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userKey,
          startedAt,
        }),
      })
    },
    [telegramUserId, update],
  )

  const markPaywallShown = useCallback(() => {
    if (isUserSubscribed(data.settings)) {
      setShowPaywall(false)
      return
    }

    if (!canActivatePaywall(data.settings)) {
      return
    }

    setShowPaywall(true)

    const alreadyShown = data.settings.paywallShown
    const subscribed =
      data.settings.isSubscribed || isSubscriptionActive(data.settings.subscriptionExpiresAt)
    const shouldStartFlashSale = !subscribed && !data.settings.paywallFlashSaleStartedAt
    const flashSaleStartedAt = shouldStartFlashSale ? new Date().toISOString() : null

    if (!alreadyShown || shouldStartFlashSale) {
      update((prev) => ({
        ...prev,
        settings: {
          ...prev.settings,
          paywallShown: true,
          ...(flashSaleStartedAt ? { paywallFlashSaleStartedAt: flashSaleStartedAt } : {}),
        },
      }))
    }

    if (flashSaleStartedAt) {
      const userKey = getClientUserKey(telegramUserId)
      scheduleFlashSaleReminderChecks(userKey, flashSaleStartedAt)

      void fetch("/api/user/register-telegram", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          telegramUserId,
          username: getWebApp()?.initDataUnsafe?.user?.username,
          firstName: getWebApp()?.initDataUnsafe?.user?.first_name,
        }),
      }).finally(() => {
        void fetch("/api/subscription/flash-sale-sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userKey,
            startedAt: flashSaleStartedAt,
          }),
        })
      })
    }

    if (!alreadyShown) {
      void trackClientAnalytics({
        event: "paywall_shown",
        userKey: getClientUserKey(telegramUserId),
        telegramUserId,
        telegramUsername: getWebApp()?.initDataUnsafe?.user?.username,
        userName: data.settings.userName || getWebApp()?.initDataUnsafe?.user?.first_name,
        age: data.settings.age,
      })
    }
  }, [
    data.settings,
    telegramUserId,
    update,
  ])

  const openPaywall = useCallback(() => {
    if (isUserSubscribed(data.settings)) return
    markPaywallShown()
  }, [data.settings, markPaywallShown])
  const closePaywall = useCallback(() => setShowPaywall(false), [])

  const homeSetupStep = useMemo((): 1 | 2 | 3 => {
    if (!isHomeSetupActive) return 3
    const activeGoals = getActiveGoals(data.goals)
    if (activeGoals.length === 0) return 1
    const flexCount = data.categories.filter((c) => c.kind === "flexible").length
    if (flexCount === 0) return 2
    return 3
  }, [isHomeSetupActive, data.goals.length, data.categories])

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
        if (!subscription) return false

        update((prev) => ({
          ...prev,
          settings: {
            ...prev.settings,
            isSubscribed: subscription.active,
            subscriptionPlan: subscription.subscriptionType,
            subscriptionExpiresAt: subscription.currentPeriodEnd,
            autoRenew: subscription.autoRenew ?? true,
            subscriptionStatus: subscription.status,
            ...(subscription.lastPaymentId
              ? { lastPaymentId: subscription.lastPaymentId }
              : {}),
          },
        }))

        if (subscription.active) {
          setShowPaywall(false)
        }

        return Boolean(subscription.active)
      } catch {
        return false
      }
    },
    [update],
  )

  const syncFlashSaleFromServer = useCallback(
    async (userKey: string) => {
      if (isUserSubscribed(data.settings)) return false
      if (!hasFreemiumTrialCompleted(data.settings)) return false

      try {
        const flashSale = await fetchServerFlashSaleStatus(userKey)
        if (!flashSale) return false

        update((prev) => ({
          ...prev,
          settings: {
            ...prev.settings,
            paywallFlashSaleStartedAt: flashSale.startedAt,
            flashSaleDurationMs: flashSale.saleDurationMs,
          },
        }))
        scheduleFlashSaleReminderChecks(userKey, flashSale.startedAt)
        return true
      } catch {
        return false
      }
    },
    [data.settings, update],
  )

  const activatePendingFlashSaleOffer = useCallback(
    async (
      userKey: string,
      options?: { showPaywall?: boolean; settings?: Settings; transactions?: Transaction[] },
    ) => {
      const settings = options?.settings ?? data.settings
      const transactions = options?.transactions ?? data.transactions

      if (isUserSubscribed(settings)) return false

      const showPaywall = options?.showPaywall ?? false
      if (showPaywall && !canActivatePaywall(settings)) return false
      if (!showPaywall && !shouldStartFlashSaleTimer(settings, transactions)) {
        return false
      }

      try {
        const response = await fetch("/api/subscription/activate-flash-offer", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userKey }),
        })
        const payload = (await response.json()) as {
          activated?: boolean
          startedAt?: string
        }

        if (!response.ok || !payload.activated || !payload.startedAt) {
          return false
        }

        persistFlashSaleStart(payload.startedAt)

        if (showPaywall) {
          update((prev) => ({
            ...prev,
            settings: {
              ...prev.settings,
              paywallShown: true,
            },
          }))
          setShowPaywall(true)
        }

        return true
      } catch {
        return false
      }
    },
    [data.settings, data.transactions, persistFlashSaleStart, update],
  )

  const maybeStartFlashSaleTimer = useCallback(async (overrides?: {
    settings?: Settings
    transactions?: Transaction[]
  }) => {
    const settings = overrides?.settings ?? data.settings
    const transactions = overrides?.transactions ?? data.transactions
    if (!shouldStartFlashSaleTimer(settings, transactions)) return

    const userKey = getClientUserKey(telegramUserId)
    const activated = await activatePendingFlashSaleOffer(userKey, {
      showPaywall: false,
      settings,
      transactions,
    })
    if (activated) return

    persistFlashSaleStart(new Date().toISOString())
  }, [
    activatePendingFlashSaleOffer,
    data.settings,
    data.transactions,
    persistFlashSaleStart,
    telegramUserId,
  ])

  const confirmPendingPayment = useCallback(async (): Promise<boolean> => {
    const paymentId = localStorage.getItem(PENDING_PAYMENT_STORAGE_KEY)
    if (!paymentId) return false

    const verified = await verifyPaymentWithRetry(paymentId)
    if (!verified) return false

    activateSubscription({
      plan: verified.plan,
      paymentId: verified.paymentId,
      expiresAt: verified.expiresAt,
      autoRenew: verified.autoRenew,
      subscriptionStatus: verified.status as Settings["subscriptionStatus"],
    })
    localStorage.removeItem(PENDING_PAYMENT_STORAGE_KEY)
    return true
  }, [activateSubscription])

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

  const setShowAddTransaction = useCallback((open: boolean) => {
    if (!open) {
      setAddTransactionDraft(null)
    }
    setShowAddTransactionState(open)
  }, [])

  const openAddTransactionForCategory = useCallback((categoryId: string) => {
    setAddTransactionDraft({ categoryId, type: "expense" })
    setShowAddTransactionState(true)
  }, [])

  const setShowBudgetPlanner = useCallback(
    (open: boolean) => {
      if (open && isContentLocked) {
        markPaywallShown()
        return
      }
      setShowBudgetPlannerState(open)
    },
    [isContentLocked, markPaywallShown],
  )

  const guardLocked = useCallback(() => {
    if (isContentLocked) {
      markPaywallShown()
      return true
    }
    return false
  }, [isContentLocked, markPaywallShown])

  const guardPremiumGoalCreation = useCallback(() => {
    if (
      requiresPremiumAfterWalkthrough &&
      getActiveGoals(data.goals).length >= 1
    ) {
      markPaywallShown()
      return true
    }
    return false
  }, [data.goals, markPaywallShown, requiresPremiumAfterWalkthrough])

  const guardPremiumGoalEdit = useCallback(() => {
    if (requiresPremiumAfterWalkthrough) {
      markPaywallShown()
      return true
    }
    return false
  }, [markPaywallShown, requiresPremiumAfterWalkthrough])

  const addTransaction = useCallback(
    (input: {
      amount: number
      type: TransactionType
      categoryId: string | null
      note: string
      date?: string
    }) => {
      const isFirstExpense =
        input.type === "expense" &&
        data.transactions.filter((tx) => tx.type === "expense").length === 0

      if (isAddingSecondExpenseAttempt(data.transactions, input.type, data.settings)) {
        if (canActivatePaywall(data.settings)) {
          markPaywallShown()
        }
        return
      }

      if (!isFirstExpense && isContentLocked) {
        markPaywallShown()
        return
      }

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
        return {
          ...prev,
          transactions: [tx, ...prev.transactions],
          settings: nextSettings,
        }
      })
      if (isFirstExpense) {
        void maybeStartFlashSaleTimer({
          settings: { ...data.settings, firstExpenseAdded: true },
          transactions: [tx, ...data.transactions],
        })
      }
      setShowAddTransactionState(false)
      setActiveTab("home")
    },
    [data.settings, data.transactions, isContentLocked, markPaywallShown, maybeStartFlashSaleTimer, update],
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

      update((prev) => {
        const periodKey = getCurrentPeriodKey(prev.settings.monthStartDay)
        const clearedTransactions = prev.transactions.map((tx) =>
          tx.categoryId && !nextCategoryIds.has(tx.categoryId)
            ? { ...tx, categoryId: null }
            : tx,
        )
        const transactions = syncBudgetIncomeTransactions(
          clearedTransactions,
          plan.incomeSources,
          periodKey,
          prev.settings.monthStartDay,
        )

        return {
          ...prev,
          budgetPlan: plan,
          categories: nextCategories,
          transactions,
          goals: prev.goals.map((goal) =>
            goal.id === primaryGoalId
              ? { ...goal, monthlyContribution: input.goalContribution }
              : goal,
          ),
        }
      })
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
      const webAppUser = getWebApp()?.initDataUnsafe?.user
      void trackClientAnalytics({
        event: "onboarding_completed",
        userKey: getClientUserKey(webAppUser?.id),
        telegramUserId: webAppUser?.id,
        telegramUsername: webAppUser?.username,
        userName: input.name,
        age: input.age,
      })
    },
    [update, setActiveTab],
  )

  const completeHomeWalkthrough = useCallback(() => {
    update((prev) => ({
      ...prev,
      settings: {
        ...prev.settings,
        homeWalkthroughCompleted: true,
      },
    }))
    const webAppUser = getWebApp()?.initDataUnsafe?.user
    void trackClientAnalytics({
      event: "walkthrough_completed",
      userKey: getClientUserKey(webAppUser?.id),
      telegramUserId: webAppUser?.id,
      telegramUsername: webAppUser?.username,
      userName: data.settings.userName || webAppUser?.first_name,
      age: data.settings.age,
    })
    void maybeStartFlashSaleTimer({
      settings: { ...data.settings, homeWalkthroughCompleted: true },
    })
  }, [data.settings.userName, data.settings.age, maybeStartFlashSaleTimer, update])

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
    hydrated,
    setActiveTab,
    setShowAddTransaction,
    openAddTransactionForCategory,
    setShowBudgetPlanner,
    setShowTransactionsList,
    openPaywall,
    closePaywall,
    activateSubscription,
    restoreSubscription,
    confirmPendingPayment,
    syncSubscriptionFromServer,
    syncFlashSaleFromServer,
    activatePendingFlashSaleOffer,
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
