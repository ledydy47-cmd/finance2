"use client"

import { useEffect } from "react"
import { BottomNav } from "@/components/finance/bottom-nav"
import { HomeWalkthrough } from "@/components/home-walkthrough/home-walkthrough"
import { OnboardingFlow } from "@/components/onboarding/onboarding-flow"
import { SubscriptionPaywallModal } from "@/components/subscription/subscription-paywall-modal"
import { AddTransactionSheet } from "@/components/screens/add-transaction-sheet"
import { BudgetPlannerScreen } from "@/components/screens/budget-planner-screen"
import { AddToGoalSheet } from "@/components/screens/add-to-goal-sheet"
import { AnalyticsScreen } from "@/components/screens/analytics-screen"
import { DashboardScreen } from "@/components/screens/dashboard-screen"
import { GoalsScreen } from "@/components/screens/goals-screen"
import { SettingsScreen } from "@/components/screens/settings-screen"
import { StatsScreen } from "@/components/screens/stats-screen"
import { TransactionsScreen } from "@/components/screens/transactions-screen"
import { useTelegram } from "@/components/telegram/telegram-provider"
import { useFinance } from "@/context/finance-context"
import { getWebApp } from "@/lib/telegram"

export function AppShell() {
  const { isTelegram } = useTelegram()
  const {
    data,
    activeTab,
    showBudgetPlanner,
    showTransactionsList,
    showAddTransaction,
    addToGoalTargetId,
    isHomeSetupActive,
    showHomeGoalSetup,
    showPaywall,
    closePaywall,
    setShowBudgetPlanner,
    setShowTransactionsList,
    setShowAddTransaction,
    closeAddToGoal,
  } = useFinance()

  const showOnboarding = !data.settings.onboardingCompleted
  const showMainApp = data.settings.onboardingCompleted
  const showHomeWalkthrough =
    isHomeSetupActive &&
    activeTab === "home" &&
    !showBudgetPlanner &&
    !showTransactionsList &&
    !showHomeGoalSetup

  useEffect(() => {
    if (!isTelegram) return
    document.documentElement.classList.add("telegram-mini-app")
    return () => document.documentElement.classList.remove("telegram-mini-app")
  }, [isTelegram])

  useEffect(() => {
    if (!isTelegram) return

    const webApp = getWebApp()
    if (!webApp) return

    const canGoBack =
      showPaywall ||
      showBudgetPlanner ||
      showTransactionsList ||
      showAddTransaction ||
      Boolean(addToGoalTargetId)

    if (!canGoBack) {
      webApp.BackButton.hide()
      return
    }

    const handleBack = () => {
      if (showPaywall) {
        closePaywall()
        return
      }
      if (showAddTransaction) {
        setShowAddTransaction(false)
        return
      }
      if (addToGoalTargetId) {
        closeAddToGoal()
        return
      }
      if (showTransactionsList) {
        setShowTransactionsList(false)
        return
      }
      if (showBudgetPlanner) {
        setShowBudgetPlanner(false)
      }
    }

    webApp.BackButton.show()
    webApp.BackButton.onClick(handleBack)
    return () => {
      webApp.BackButton.offClick(handleBack)
      webApp.BackButton.hide()
    }
  }, [
    isTelegram,
    showPaywall,
    showBudgetPlanner,
    showTransactionsList,
    showAddTransaction,
    addToGoalTargetId,
    closePaywall,
    closeAddToGoal,
    setShowAddTransaction,
    setShowTransactionsList,
    setShowBudgetPlanner,
  ])

  const shellClassName = isTelegram
    ? "relative flex h-[100dvh] w-full flex-col overflow-hidden bg-background pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]"
    : "relative flex h-[100dvh] w-full max-w-[420px] flex-col overflow-hidden bg-background sm:h-[860px] sm:rounded-[3rem] sm:shadow-2xl sm:shadow-primary/20 sm:ring-8 sm:ring-card"

  const mainClassName = isTelegram
    ? "min-h-[100dvh] bg-background"
    : "flex min-h-screen items-center justify-center bg-muted p-0 sm:p-6"

  return (
    <main className={mainClassName}>
      <div data-app-shell className={shellClassName}>
        {showMainApp && (
          <div className="flex min-h-0 flex-1 flex-col">
            {activeTab === "home" && <DashboardScreen />}
            {activeTab === "stats" && <StatsScreen />}
            {activeTab === "goals" && <GoalsScreen />}
            {activeTab === "analytics" && <AnalyticsScreen />}
            {activeTab === "settings" && <SettingsScreen />}

            <div className="absolute inset-x-0 bottom-0">
              {!showBudgetPlanner && !showTransactionsList && <BottomNav />}
            </div>

            <BudgetPlannerScreen />
            <TransactionsScreen />
            <AddTransactionSheet />
            <AddToGoalSheet />

            {showHomeWalkthrough && <HomeWalkthrough />}

            {showPaywall && (
              <SubscriptionPaywallModal onClose={closePaywall} />
            )}
          </div>
        )}

        {showOnboarding && <OnboardingFlow />}
      </div>
    </main>
  )
}
