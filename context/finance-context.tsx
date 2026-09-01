"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
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
import { loadAppData, saveAppData, getSaveErrorMessage } from "@/lib/storage"
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
import {
  clearFlashSaleReminderWatch,
  scheduleFlashSaleReminderChecks,
} from "@/lib/client/flash-sale-reminder-client"
import {
  canActivatePaywall,
  hasFreemiumTrialCompleted,
  isAddingSecondExpenseAttempt,
  resolvePaywallAccess,
  shouldStartFlashSaleTimer,
} from "@/lib/paywall-experiment"
import { ensureTelegramSdk, getWebApp, waitForTelegramWebApp } from "@/lib/telegram"
import type { SubscriptionPlan } from "@/lib/subscription"
import { isSubscriptionActive, PENDING_ORDER_ID_KEY, PENDING_PAYMENT_STORAGE_KEY } from "@/lib/subscription"
import { verifyPaymentByOrderWithRetry, verifyPaymentWithRetry } from "@/lib/pending-payment-verify"
import {
  fetchServerFlashSaleStatus,
  fetchServerSubscriptionSettings,
  mergeActiveSubscriptionSettings,
} from "@/lib/subscription-sync-client"
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
  refreshSubscriptionAfterExternalPayment: (userKey: string) => Promise<boolean>
  syncSubscriptionFromServer: (userKey: string) => Promise<boolean>
  syncFlashSaleFromServer: (userKey: string) => Promise<boolean>
  activatePendingFlashSaleOffer: (userKey: string) => Promise<boolean>
  prepareFlashSaleOnAppOpen: (userKey: string) => Promise<void>
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
  addGoal: (input: Omit<Goal, "id" | "savedAmount">) => boolean
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
  persistError: string | null
  clearPersistError: () => void
}

const FinanceContext = createContext<FinanceContextValue | null>(null)

function hydrationTimeout(ms: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms)
  })
}

async function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([promise, hydrationTimeout(ms).then(() => fallback)])
}

async function syncHydrationFromServer(input: {
  userKey: string
  loaded: AppData
  appliedOnboardingReset: boolean
}) {
  let loaded = input.loaded

  const pendingReset = await withTimeout(fetchPendingAppReset(input.userKey), 4000, null)
  if (pendingReset) {
    loaded = applyRemoteAppReset(loaded, pendingReset)
    markResetApplied(pendingReset.resetId)
    saveAppData(loaded)
    if (pendingReset.resetToOnboarding) {
      return { loaded, appliedOnboardingReset: true }
    }
  }

  if (!input.appliedOnboardingReset) {
    const progress = await withTimeout(fetchUserProgress(input.userKey), 4000, null)
    if (progress) {
      loaded = mergeServerProgressIntoAppData(loaded, progress)
    }
  }

  const subscriptionPatch = await withTimeout(
    fetchServerSubscriptionSettings(input.userKey),
    4000,
    null,
  )
  if (subscriptionPatch) {
    loaded = {
      ...loaded,
      settings: mergeActiveSubscriptionSettings(loaded.settings, subscriptionPatch),
    }
  }

  const flashSalePatch = await withTimeout(fetchServerFlashSaleStatus(input.userKey), 4000, null)
  if (
    flashSalePatch?.active &&
    flashSalePatch.startedAt &&
    flashSalePatch.saleDurationMs &&
    !isUserSubscribed(loaded.settings) &&
    hasFreemiumTrialCompleted(loaded.settings)
  ) {
    loaded = {
      ...loaded,
      settings: {
        ...loaded.settings,
        paywallFlashSaleStartedAt: flashSalePatch.startedAt,
        flashSaleDurationMs: flashSalePatch.saleDurationMs,
        ...(flashSalePatch.promotionId
          ? { paywallPromotionId: flashSalePatch.promotionId }
          : {}),
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
  const [persistError, setPersistError] = useState<string | null>(null)
  const dataRef = useRef(data)

  useEffect(() => {
    dataRef.current = data
  }, [data])

  useEffect(() => {
    let cancelled = false
    const safetyTimer = window.setTimeout(() => {
      if (!cancelled) setHydrated(true)
    }, 3000)

    const revealLoadedData = (loaded: AppData) => {
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

    const finishHydration = async () => {
      let loaded = createDefaultData()

      try {
        await withTimeout(waitForTelegramWebApp(1500), 1500, undefined)
        if (cancelled) return

        await withTimeout(ensureTelegramSdk().catch(() => undefined), 2000, undefined)
        if (cancelled) return

        loaded = loadAppData()
        if (cancelled) return

        revealLoadedData(loaded)

        const webAppUser = getWebApp()?.initDataUnsafe?.user
        const userKey = getClientUserKey(webAppUser?.id)

        if (userKey.startsWith("tg-")) {
          const synced = await withTimeout(
            syncHydrationFromServer({
              userKey,
              loaded,
              appliedOnboardingReset: false,
            }),
            8000,
            { loaded, appliedOnboardingReset: false },
          )
          loaded = synced.loaded
        } else {
          try {
            const pendingReset = await withTimeout(fetchPendingAppReset(userKey), 4000, null)
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
    }

    void finishHydration()

    return () => {
      cancelled = true
      window.clearTimeout(safetyTimer)
    }
  }, [])

  useEffect(() => {
    if (!hydrated) return
    const result = saveAppData(data)
    if (!result.ok) {
      setPersistError(getSaveErrorMessage(result))
    }
  }, [data, hydrated])

  const clearPersistError = useCallback(() => setPersistError(null), [])

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

  const update = useCallback(
    (updater: (prev: AppData) => AppData): boolean => {
      const next = updater(dataRef.current)
      if (!hydrated) {
        setData(next)
        dataRef.current = next
        return true
      }

      const result = saveAppData(next)
      if (!result.ok) {
        setPersistError(getSaveErrorMessage(result))
        return false
      }

      setPersistError(null)
      setData(next)
      dataRef.current = next
      return true
    },
    [hydrated],
  )

  const telegramUserId = getWebApp()?.initDataUnsafe?.user?.id
  const paywallAccess = useMemo(
    () => resolvePaywallAccess(data.settings),
    [data.settings],
  )
  const isContentLocked = paywallAccess.isContentLocked
  const requiresPremiumAfterWalkthrough = paywallAccess.requiresPremiumAfterWalkthrough

  const persistFlashSaleStart = useCallback(
    (
      startedAt: string,
      options?: { durationMs?: number | null; promotionId?: string | null },
    ) => {
      update((prev) => ({
        ...prev,
        settings: {
          ...prev.settings,
          paywallFlashSaleStartedAt: startedAt,
          ...(options?.durationMs ? { flashSaleDurationMs: options.durationMs } : {}),
          ...(options?.promotionId ? { paywallPromotionId: options.promotionId } : {}),
        },
      }))

      const userKey = getClientUserKey(telegramUserId)
      if (!options?.promotionId) {
        scheduleFlashSaleReminderChecks(userKey, startedAt)
      }

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

  const commitPaywallOfferSideEffects = useCallback(() => {
    if (isUserSubscribed(data.settings)) return

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
  }, [data.settings, telegramUserId, update])

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
        settings: mergeActiveSubscriptionSettings(prev.settings, {
          isSubscribed: true,
          subscriptionPlan: input.plan,
          subscriptionExpiresAt: input.expiresAt,
          lastPaymentId: input.paymentId,
          autoRenew: input.autoRenew ?? true,
          subscriptionStatus: input.subscriptionStatus ?? "active",
        }),
      }))
      clearFlashSaleReminderWatch(getClientUserKey(telegramUserId))
      setShowPaywall(false)
    },
    [telegramUserId, update],
  )

  const syncSubscriptionFromServer = useCallback(
    async (userKey: string) => {
      try {
        const response = await fetch(
          `/api/subscription/status?userKey=${encodeURIComponent(userKey)}`,
          { cache: "no-store" },
        )
        const payload = await response.json()
        const subscription = payload.subscription
        if (!subscription) return false

        update((prev) => ({
          ...prev,
          settings: mergeActiveSubscriptionSettings(prev.settings, {
            isSubscribed: subscription.active,
            subscriptionPlan: subscription.subscriptionType,
            subscriptionExpiresAt: subscription.currentPeriodEnd,
            autoRenew: subscription.autoRenew ?? true,
            subscriptionStatus: subscription.status,
            ...(subscription.lastPaymentId
              ? { lastPaymentId: subscription.lastPaymentId }
              : {}),
          }),
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

  const confirmPendingPayment = useCallback(async (): Promise<boolean> => {
    const orderId = localStorage.getItem(PENDING_ORDER_ID_KEY)?.trim()
    if (orderId) {
      const verifiedByOrder = await verifyPaymentByOrderWithRetry(orderId, {
        maxAttempts: 8,
        intervalMs: 1500,
      })
      if (verifiedByOrder) {
        activateSubscription({
          plan: verifiedByOrder.plan,
          paymentId: verifiedByOrder.paymentId,
          expiresAt: verifiedByOrder.expiresAt,
          autoRenew: verifiedByOrder.autoRenew,
          subscriptionStatus: verifiedByOrder.status as Settings["subscriptionStatus"],
        })
        localStorage.removeItem(PENDING_PAYMENT_STORAGE_KEY)
        localStorage.removeItem(PENDING_ORDER_ID_KEY)
        return true
      }
    }

    const paymentId = localStorage.getItem(PENDING_PAYMENT_STORAGE_KEY)
    if (!paymentId) return false

    const verified = await verifyPaymentWithRetry(paymentId, {
      maxAttempts: 8,
      intervalMs: 1500,
    })
    if (!verified) return false

    activateSubscription({
      plan: verified.plan,
      paymentId: verified.paymentId,
      expiresAt: verified.expiresAt,
      autoRenew: verified.autoRenew,
      subscriptionStatus: verified.status as Settings["subscriptionStatus"],
    })
    localStorage.removeItem(PENDING_PAYMENT_STORAGE_KEY)
    localStorage.removeItem(PENDING_ORDER_ID_KEY)
    return true
  }, [activateSubscription])

  const refreshSubscriptionAfterExternalPayment = useCallback(
    async (userKey: string) => {
      if (await syncSubscriptionFromServer(userKey)) {
        localStorage.removeItem(PENDING_PAYMENT_STORAGE_KEY)
        localStorage.removeItem(PENDING_ORDER_ID_KEY)
        return true
      }

      if (await confirmPendingPayment()) {
        return true
      }

      return syncSubscriptionFromServer(userKey)
    },
    [confirmPendingPayment, syncSubscriptionFromServer],
  )

  const syncFlashSaleFromServer = useCallback(
    async (userKey: string) => {
      if (isUserSubscribed(data.settings)) return false
      if (!hasFreemiumTrialCompleted(data.settings)) return false

      try {
        const flashSale = await fetchServerFlashSaleStatus(userKey)
        if (!flashSale?.active || !flashSale.startedAt || !flashSale.saleDurationMs) {
          return false
        }

        update((prev) => ({
          ...prev,
          settings: {
            ...prev.settings,
            paywallFlashSaleStartedAt: flashSale.startedAt!,
            flashSaleDurationMs: flashSale.saleDurationMs,
            ...(flashSale.promotionId
              ? { paywallPromotionId: flashSale.promotionId }
              : {}),
          },
        }))
        if (!flashSale.promotionId) {
          scheduleFlashSaleReminderChecks(userKey, flashSale.startedAt)
        }
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

      try {
        const response = await fetch("/api/subscription/activate-flash-offer", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userKey }),
        })
        const payload = (await response.json()) as {
          activated?: boolean
          startedAt?: string
          promotionId?: string | null
          saleDurationMs?: number | null
        }

        if (response.ok && payload.activated && payload.startedAt) {
          persistFlashSaleStart(payload.startedAt, {
            durationMs: payload.saleDurationMs,
            promotionId: payload.promotionId,
          })

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
        }
      } catch {
        // fall through — no pending server-side offer
      }

      if (!showPaywall && !shouldStartFlashSaleTimer(settings, transactions)) {
        return false
      }
      if (showPaywall) return false

      persistFlashSaleStart(new Date().toISOString())
      return true
    },
    [data.settings, data.transactions, persistFlashSaleStart, update],
  )

  const maybeStartFlashSaleTimer = useCallback(async (overrides?: {
    settings?: Settings
    transactions?: Transaction[]
  }) => {
    const settings = overrides?.settings ?? data.settings
    const transactions = overrides?.transactions ?? data.transactions

    const userKey = getClientUserKey(telegramUserId)
    const activated = await activatePendingFlashSaleOffer(userKey, {
      showPaywall: false,
      settings,
      transactions,
    })
    if (activated) return

    if (!shouldStartFlashSaleTimer(settings, transactions)) return

    persistFlashSaleStart(new Date().toISOString())
  }, [
    activatePendingFlashSaleOffer,
    data.settings,
    data.transactions,
    persistFlashSaleStart,
    telegramUserId,
  ])

  const prepareFlashSaleOnAppOpen = useCallback(
    async (userKey: string) => {
      if (isUserSubscribed(data.settings)) return

      const activated = await activatePendingFlashSaleOffer(userKey)
      if (activated) return

      await syncFlashSaleFromServer(userKey)
    },
    [activatePendingFlashSaleOffer, data.settings, syncFlashSaleFromServer],
  )

  const markPaywallShown = useCallback(() => {
    if (isUserSubscribed(data.settings)) {
      setShowPaywall(false)
      return
    }

    if (!canActivatePaywall(data.settings)) {
      return
    }

    void (async () => {
      const userKey = getClientUserKey(telegramUserId)
      const activated = await activatePendingFlashSaleOffer(userKey)
      if (!activated) {
        commitPaywallOfferSideEffects()
      } else {
        update((prev) => ({
          ...prev,
          settings: {
            ...prev.settings,
            paywallShown: true,
          },
        }))
        if (!data.settings.paywallShown) {
          void trackClientAnalytics({
            event: "paywall_shown",
            userKey,
            telegramUserId,
            telegramUsername: getWebApp()?.initDataUnsafe?.user?.username,
            userName: data.settings.userName || getWebApp()?.initDataUnsafe?.user?.first_name,
            age: data.settings.age,
          })
        }
      }
      setShowPaywall(true)
    })()
  }, [
    activatePendingFlashSaleOffer,
    commitPaywallOfferSideEffects,
    data.settings,
    telegramUserId,
    update,
  ])

  const openPaywall = useCallback(() => {
    if (isUserSubscribed(data.settings)) return
    void (async () => {
      const userKey = getClientUserKey(telegramUserId)
      const activated = await activatePendingFlashSaleOffer(userKey)
      if (!activated) {
        commitPaywallOfferSideEffects()
      }
      setShowPaywall(true)
    })()
  }, [activatePendingFlashSaleOffer, commitPaywallOfferSideEffects, data.settings, telegramUserId])

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
    (input: Omit<Goal, "id" | "savedAmount">): boolean => {
      if (guardPremiumGoalCreation()) return false
      if (guardLocked()) return false
      const goal: Goal = { ...input, id: crypto.randomUUID(), savedAmount: 0 }
      return update((prev) => ({
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
    refreshSubscriptionAfterExternalPayment,
    syncSubscriptionFromServer,
    syncFlashSaleFromServer,
    activatePendingFlashSaleOffer,
    prepareFlashSaleOnAppOpen,
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
    persistError,
    clearPersistError,
  }

  return <FinanceContext.Provider value={value}>{children}</FinanceContext.Provider>
}

export function useFinance() {
  const ctx = useContext(FinanceContext)
  if (!ctx) throw new Error("useFinance must be used within FinanceProvider")
  return ctx
}
