"use client"

import { useMemo } from "react"
import { Calculator, Plus } from "lucide-react"
import { TransactionsList } from "@/components/finance/transactions-list"
import { BalanceCard } from "@/components/finance/balance-card"
import { HomeCategoryCard } from "@/components/finance/home-category-card"
import { GoalCard } from "@/components/finance/goal-card"
import { GhostCategoryRows } from "@/components/home-setup/ghost-category-rows"
import { GhostGoalCard } from "@/components/home-setup/ghost-goal-card"
import { HomeGoalSetupSheet } from "@/components/home-setup/home-goal-setup-sheet"
import { useFinance } from "@/context/finance-context"
import { getActiveGoals } from "@/lib/goals"
import { getCategoryExpenseCount, getCategorySpent, getPeriodTransactions } from "@/lib/calculations"
import { getDaysLeftInPeriod } from "@/lib/period"

export function DashboardScreen() {
  const {
    data,
    periodKey,
    periodLabel,
    summary,
    setActiveTab,
    setShowAddTransaction,
    openAddTransactionForCategory,
    setShowBudgetPlanner,
    showBudgetPlanner,
    setShowTransactionsList,
    openAddToGoal,
    getPrimaryGoal,
    isHomeSetupActive,
    homeSetupStep,
    setShowHomeGoalSetup,
    showHomeGoalSetup,
    completeHomeWalkthrough,
    isContentLocked,
  } = useFinance()

  const featuredGoal = getPrimaryGoal()
  const activeGoals = getActiveGoals(data.goals)
  const showGhostGoal = isHomeSetupActive && activeGoals.length === 0
  const showRealGoal = Boolean(featuredGoal)
  const showGhostCategories =
    isHomeSetupActive && data.categories.filter((c) => c.kind === "flexible").length === 0
  const showRealCategories = data.categories.length > 0

  const periodTransactions = useMemo(
    () =>
      getPeriodTransactions(data.transactions, periodKey, data.settings.monthStartDay).slice(0, 3),
    [data.transactions, periodKey, data.settings.monthStartDay],
  )

  const hasAnyTransactions = data.transactions.length > 0
  const daysLeftInPeriod = getDaysLeftInPeriod(data.settings.monthStartDay)

  function handleGhostGoalClick() {
    if (isHomeSetupActive && homeSetupStep === 1) {
      setShowHomeGoalSetup(true)
    }
  }

  function handleBudgetPlannerOpen() {
    setShowBudgetPlanner(true)
  }

  function handleAddTransaction() {
    if (isHomeSetupActive && homeSetupStep === 3) {
      completeHomeWalkthrough()
    }
    setShowAddTransaction(true)
  }

  return (
    <>
      <header className="px-5 pb-2 pt-4">
        <p className="text-sm font-medium text-muted-foreground">
          Привет, {data.settings.userName}
        </p>
        <h1 className="font-serif text-2xl font-bold text-foreground">{periodLabel}</h1>
      </header>

      <div className="flex-1 overflow-y-auto px-5 pb-28" data-home-scroll>
        {(showGhostGoal || showRealGoal) && (
          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-serif text-lg font-bold text-foreground">Моя цель</h2>
              {showRealGoal && !isHomeSetupActive && (
                <button
                  type="button"
                  onClick={() => setActiveTab("goals")}
                  className="text-xs font-semibold text-primary"
                >
                  Все цели
                </button>
              )}
            </div>

            {showGhostGoal && (
              <GhostGoalCard
                onClick={handleGhostGoalClick}
                highlighted={isHomeSetupActive && homeSetupStep === 1}
              />
            )}

            {showRealGoal && featuredGoal && (
              <div
                className={
                  isHomeSetupActive
                    ? "animate-in fade-in zoom-in-95 duration-500 fill-mode-both"
                    : undefined
                }
              >
                <GoalCard
                  name={featuredGoal.name}
                  saved={featuredGoal.savedAmount}
                  target={featuredGoal.targetAmount}
                  image={featuredGoal.image}
                  isPrimary
                  onAdd={() => openAddToGoal(featuredGoal.id)}
                />
              </div>
            )}
          </section>
        )}

        <div className="mt-6">
          <BalanceCard left={summary.left} income={summary.income} spent={summary.spent} />
        </div>

        <button
          type="button"
          data-tour="budget-planner"
          onClick={handleBudgetPlannerOpen}
          className={`mt-4 flex w-full items-center gap-3 rounded-block bg-card p-4 text-left shadow-sm shadow-primary/5 transition-transform active:scale-[0.98] ${
            isHomeSetupActive && homeSetupStep === 2 && !showBudgetPlanner ? "relative z-[65]" : ""
          }`}
        >
          <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary/15">
            <Calculator className="size-6 text-primary" strokeWidth={2.2} />
          </span>
          <span>
            <span className="block font-serif text-[15px] font-bold text-foreground">
              Спланировать бюджет
            </span>
            <span className="mt-0.5 block text-xs text-muted-foreground">
              Распределите доход по категориям и мечте
            </span>
          </span>
        </button>

        <section className="mt-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-serif text-lg font-bold text-foreground">Категории</h2>
            {showRealCategories && !isHomeSetupActive && (
              <button
                type="button"
                onClick={() => setShowBudgetPlanner(true)}
                className="text-xs font-semibold text-primary"
              >
                Изменить
              </button>
            )}
          </div>

          {showGhostCategories && <GhostCategoryRows />}

          {showRealCategories && (
            <div
              className={`flex flex-col gap-3 ${
                isHomeSetupActive && homeSetupStep >= 2
                  ? "animate-in fade-in zoom-in-95 duration-500 fill-mode-both"
                  : ""
              }`}
            >
              {data.categories.map((category) => (
                <HomeCategoryCard
                  key={category.id}
                  categoryId={category.id}
                  icon={category.icon}
                  name={category.name}
                  spent={getCategorySpent(
                    data.transactions,
                    category.id,
                    periodKey,
                    data.settings.monthStartDay,
                  )}
                  budget={category.monthlyLimit}
                  transactionCount={getCategoryExpenseCount(
                    data.transactions,
                    category.id,
                    periodKey,
                    data.settings.monthStartDay,
                  )}
                  daysLeft={daysLeftInPeriod}
                  tint={category.tint}
                  bar={category.bar}
                  onQuickAdd={isHomeSetupActive ? undefined : openAddTransactionForCategory}
                />
              ))}
            </div>
          )}
        </section>

        <section className="mt-6">
          <div className="mb-1 flex items-center justify-between">
            <h2 className="font-serif text-lg font-bold text-foreground">Последние операции</h2>
            {hasAnyTransactions && (
              <button
                type="button"
                onClick={() => setShowTransactionsList(true)}
                className="text-xs font-semibold text-primary"
              >
                Все
              </button>
            )}
          </div>
          {periodTransactions.length === 0 ? (
            <div className="rounded-block bg-card px-4 py-8 text-center shadow-sm shadow-primary/5">
              <p className="text-sm text-muted-foreground">Пока нет операций в этом месяце</p>
              {!isHomeSetupActive && (
                <button
                  type="button"
                  onClick={() => setShowAddTransaction(true)}
                  className="mt-3 text-sm font-semibold text-primary"
                >
                  Добавить первую
                </button>
              )}
            </div>
          ) : (
            <TransactionsList
              transactions={periodTransactions}
              emptyMessage="Пока нет операций в этом месяце"
            />
          )}
        </section>
      </div>

      <button
        type="button"
        aria-label="Добавить операцию"
        data-tour="add-button"
        onClick={handleAddTransaction}
        className={`absolute bottom-24 right-5 flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/40 transition-transform active:scale-95 ${
          isHomeSetupActive && homeSetupStep === 3 ? "z-[65]" : ""
        } ${isContentLocked ? "opacity-80" : ""}`}
      >
        <Plus className="size-7" strokeWidth={2.6} />
      </button>

      {showHomeGoalSetup && <HomeGoalSetupSheet />}
    </>
  )
}
