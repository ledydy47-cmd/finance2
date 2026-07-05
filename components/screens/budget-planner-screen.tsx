"use client"

import { useEffect, useMemo, useRef, useState, type RefObject } from "react"
import { CategoryIconPicker } from "@/components/finance/category-icon-picker"
import { BudgetPlannerCoachMark } from "@/components/home-walkthrough/budget-planner-coach-mark"
import { useFinance } from "@/context/finance-context"
import { sanitizeAmountInput } from "@/lib/amount-input"
import {
  computeBudgetTotals,
  createDefaultIncomeSources,
  createDefaultMandatoryExpenses,
  parseAmount,
  paletteForIndex,
  type CategoryDraftMeta,
} from "@/lib/budget-planner"
import {
  CATEGORY_ICON_OPTIONS,
  iconOptionForCategoryId,
  type CategoryIconOption,
} from "@/lib/category-icons"
import { formatRub } from "@/lib/format"
import { SETUP_TOUR_CATEGORIES } from "@/lib/setup-tour"
import type { Category } from "@/lib/types"

interface EntryDraft {
  id: string
  name: string
  amount: string
}

interface FlexibleDraft extends EntryDraft, CategoryDraftMeta {
  iconKey: string
}

function toEntries(drafts: EntryDraft[]) {
  return drafts.map((e) => ({
    id: e.id,
    name: e.name.trim(),
    amount: parseAmount(e.amount),
  }))
}

function PillInput({
  value,
  onChange,
  placeholder,
  numericOnly = false,
  className = "",
  inputRef,
  dataTour,
  onFocus,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  numericOnly?: boolean
  className?: string
  inputRef?: RefObject<HTMLInputElement | null>
  dataTour?: string
  onFocus?: () => void
}) {
  return (
    <input
      ref={inputRef}
      type="text"
      inputMode={numericOnly ? "numeric" : "text"}
      value={value}
      data-tour={dataTour}
      onFocus={onFocus}
      onChange={(e) => {
        const next = numericOnly ? sanitizeAmountInput(e.target.value) : e.target.value
        onChange(next)
      }}
      placeholder={placeholder}
      className={`rounded-full border-0 bg-primary/10 px-4 py-2.5 text-sm font-semibold text-foreground outline-none ring-primary focus:ring-2 ${className}`}
    />
  )
}

function EntryListSection({
  title,
  subtotalLabel,
  subtotal,
  entries,
  onAdd,
  onUpdate,
  onRemove,
  addLabel,
}: {
  title: string
  subtotalLabel: string
  subtotal: number
  entries: EntryDraft[]
  onAdd: () => void
  onUpdate: (id: string, patch: Partial<EntryDraft>) => void
  onRemove: (id: string) => void
  addLabel: string
}) {
  return (
    <section className="rounded-block bg-card p-4 shadow-sm shadow-primary/5">
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <h2 className="font-serif text-base font-bold text-foreground">{title}</h2>
        <p className="text-xs font-semibold text-muted-foreground">
          {subtotalLabel}: {formatRub(subtotal)}
        </p>
      </div>

      <div className="flex flex-col gap-2">
        {entries.map((entry) => (
          <div key={entry.id} className="flex items-center gap-2">
            <PillInput
              value={entry.name}
              onChange={(name) => onUpdate(entry.id, { name })}
              placeholder="Название"
              className="min-w-0 flex-1"
            />
            <PillInput
              value={entry.amount}
              onChange={(amount) => onUpdate(entry.id, { amount })}
              placeholder="0"
              numericOnly
              className="w-24 text-right"
            />
            <button
              type="button"
              onClick={() => onRemove(entry.id)}
              aria-label="Удалить"
              className="flex size-9 shrink-0 items-center justify-center rounded-full border border-primary/20 text-sm font-bold text-muted-foreground"
            >
              ×
            </button>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={onAdd}
        className="mt-3 flex w-full items-center justify-center rounded-block-sm border-2 border-dashed border-primary/30 py-2.5 text-sm font-bold text-primary"
      >
        + {addLabel}
      </button>
    </section>
  )
}

function draftFromOption(option: CategoryIconOption, id: string, name: string, amount: string): FlexibleDraft {
  return {
    id,
    name,
    amount,
    iconKey: option.key,
    icon: option.icon,
    tint: option.tint,
    bar: option.bar,
  }
}

function categoryToFlexibleDraft(category: Category, amount: string): FlexibleDraft {
  const option = iconOptionForCategoryId(category.id)
  return draftFromOption(option, category.id, category.name, amount)
}

export function BudgetPlannerScreen() {
  const {
    data,
    summary,
    showBudgetPlanner,
    setShowBudgetPlanner,
    applyBudgetPlan,
    getPrimaryGoal,
    isHomeSetupActive,
  } = useFinance()

  const [incomeSources, setIncomeSources] = useState<EntryDraft[]>([])
  const [mandatoryExpenses, setMandatoryExpenses] = useState<EntryDraft[]>([])
  const [flexibleCategories, setFlexibleCategories] = useState<FlexibleDraft[]>([])
  const [coachMarkDismissed, setCoachMarkDismissed] = useState(false)
  const [openIconPickerId, setOpenIconPickerId] = useState<string | null>(null)
  const budgetIntroRef = useRef<HTMLElement>(null)
  const firstCategoryAmountRef = useRef<HTMLInputElement>(null)

  const primaryGoal = getPrimaryGoal()

  useEffect(() => {
    if (!showBudgetPlanner) {
      setCoachMarkDismissed(false)
      setOpenIconPickerId(null)
      return
    }

    const plan = data.budgetPlan
    const mandatoryCats = data.categories.filter((c) => c.kind === "mandatory")
    const flexibleCats = data.categories.filter((c) => c.kind === "flexible")

    const mandatory = plan?.mandatoryExpenses?.length
      ? plan.mandatoryExpenses
      : mandatoryCats.length > 0
        ? mandatoryCats.map((c) => ({ id: c.id, name: c.name, amount: c.monthlyLimit }))
        : createDefaultMandatoryExpenses()

    const incomes = isHomeSetupActive
      ? plan?.incomeSources?.length
        ? plan.incomeSources
        : [{ id: "income-salary", name: "Зарплата", amount: 0 }]
      : plan?.incomeSources?.length
        ? plan.incomeSources
        : summary.income > 0
          ? [{ id: "income-salary", name: "Зарплата", amount: summary.income }]
          : createDefaultIncomeSources()

    setIncomeSources(
      incomes.map((e) => ({
        id: e.id,
        name: e.name,
        amount: e.amount > 0 ? String(e.amount) : "",
      })),
    )

    setMandatoryExpenses(
      mandatory.map((e) => ({
        id: e.id,
        name: e.name,
        amount: e.amount > 0 ? String(e.amount) : "",
      })),
    )

    const flexList =
      flexibleCats.length > 0
        ? flexibleCats
        : isHomeSetupActive
          ? SETUP_TOUR_CATEGORIES.map((cat, i) => {
              const option = iconOptionForCategoryId(cat.id)
              const palette = paletteForIndex(i)
              return {
                id: cat.id,
                name: cat.name,
                icon: option.icon,
                tint: option.tint,
                bar: option.bar,
                monthlyLimit: 0,
                kind: "flexible" as const,
              }
            })
          : data.categories.filter((c) => c.kind !== "mandatory")

    setFlexibleCategories(
      flexList.map((category) => {
        const fromPlan = plan?.categoryAllocations[category.id]
        const amount = fromPlan ?? category.monthlyLimit
        return categoryToFlexibleDraft(category, amount > 0 ? String(amount) : "")
      }),
    )
  }, [showBudgetPlanner, data.budgetPlan, data.categories, summary.income, isHomeSetupActive])

  const incomeNumeric = useMemo(() => toEntries(incomeSources), [incomeSources])
  const mandatoryNumeric = useMemo(() => toEntries(mandatoryExpenses), [mandatoryExpenses])
  const flexibleNumeric = useMemo(() => toEntries(flexibleCategories), [flexibleCategories])

  const numericAllocations = useMemo(
    () => Object.fromEntries(flexibleNumeric.map((c) => [c.id, c.amount])),
    [flexibleNumeric],
  )

  const { incomeTotal, mandatoryTotal, remaining, dreamAmount, overspent } = computeBudgetTotals(
    incomeNumeric,
    mandatoryNumeric,
    numericAllocations,
  )

  function dismissCoachMark() {
    setCoachMarkDismissed(true)
  }

  function handleCategoryAmountChange(categoryId: string, amount: string) {
    if (isHomeSetupActive && !coachMarkDismissed) {
      dismissCoachMark()
    }
    setFlexibleCategories((prev) =>
      prev.map((c) => (c.id === categoryId ? { ...c, amount } : c)),
    )
  }

  function handleApply() {
    if (overspent || incomeTotal <= 0) return
    applyBudgetPlan({
      incomeSources: incomeNumeric.filter((e) => e.name && e.amount > 0),
      mandatoryExpenses: mandatoryNumeric.filter((e) => e.name && e.amount > 0),
      flexibleCategories: flexibleCategories
        .filter((c) => c.name.trim())
        .map((c) => ({
          id: c.id,
          name: c.name.trim(),
          amount: parseAmount(c.amount),
          icon: c.icon,
          tint: c.tint,
          bar: c.bar,
        })),
      goalContribution: dreamAmount,
    })
  }

  function addFlexibleCategory() {
    const usedKeys = new Set(flexibleCategories.map((c) => c.iconKey))
    const option =
      CATEGORY_ICON_OPTIONS.find((o) => !usedKeys.has(o.key)) ??
      CATEGORY_ICON_OPTIONS[flexibleCategories.length % CATEGORY_ICON_OPTIONS.length]
    setFlexibleCategories((prev) => [
      ...prev,
      draftFromOption(option, crypto.randomUUID(), "", ""),
    ])
  }

  if (!showBudgetPlanner) return null

  return (
    <div className="absolute inset-0 z-[70] flex flex-col bg-background">
      <header ref={budgetIntroRef} className="flex items-center gap-3 px-4 pb-2 pt-4">
        <button
          type="button"
          onClick={() => setShowBudgetPlanner(false)}
          aria-label="Назад"
          className="flex size-10 items-center justify-center rounded-full bg-card text-lg shadow-sm shadow-primary/5"
        >
          ←
        </button>
        <h1 className="font-serif text-xl font-bold text-foreground">Планирование бюджета 🧮</h1>
      </header>

      <div className="flex-1 overflow-y-auto px-5 pb-36 pt-2">
        <EntryListSection
          title="Мой доход"
          subtotalLabel="Доход"
          subtotal={incomeTotal}
          entries={incomeSources}
          onAdd={() =>
            setIncomeSources((prev) => [...prev, { id: crypto.randomUUID(), name: "", amount: "" }])
          }
          onUpdate={(id, patch) =>
            setIncomeSources((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)))
          }
          onRemove={(id) => setIncomeSources((prev) => prev.filter((e) => e.id !== id))}
          addLabel="Добавить доход"
        />

        <div className="mt-4">
          <EntryListSection
            title="Обязательные расходы"
            subtotalLabel="Обязательные"
            subtotal={mandatoryTotal}
            entries={mandatoryExpenses}
            onAdd={() =>
              setMandatoryExpenses((prev) => [
                ...prev,
                { id: crypto.randomUUID(), name: "", amount: "" },
              ])
            }
            onUpdate={(id, patch) =>
              setMandatoryExpenses((prev) =>
                prev.map((e) => (e.id === id ? { ...e, ...patch } : e)),
              )
            }
            onRemove={(id) => setMandatoryExpenses((prev) => prev.filter((e) => e.id !== id))}
            addLabel="Добавить расход"
          />
          <p className="mt-2 px-1 text-xs text-muted-foreground">
            Станут категориями на главной после применения бюджета
          </p>
        </div>

        <section
          className={`mt-4 rounded-block p-5 shadow-sm shadow-primary/10 ${
            overspent ? "bg-destructive/10" : "bg-primary/10"
          }`}
        >
          <p className="text-sm font-semibold text-muted-foreground">Осталось распределить</p>
          <p
            className={`mt-1 font-serif text-4xl font-bold tracking-tight ${
              overspent ? "text-destructive" : "text-primary"
            }`}
          >
            {formatRub(remaining)}
          </p>
          {overspent && (
            <p className="mt-2 text-sm font-semibold text-destructive">
              Вы распределили больше, чем есть 🙈
            </p>
          )}
        </section>

        <section className="mt-4 rounded-block bg-card p-4 shadow-sm shadow-primary/5">
          <h2 className="mb-3 font-serif text-base font-bold text-foreground">
            Распределение по категориям
          </h2>
          <div className="flex flex-col gap-3">
            {flexibleCategories.map((category, index) => (
              <div key={category.id} className="flex items-center gap-2">
                <CategoryIconPicker
                  value={category}
                  open={openIconPickerId === category.id}
                  onOpenChange={(open) => setOpenIconPickerId(open ? category.id : null)}
                  onChange={(option) =>
                    setFlexibleCategories((prev) =>
                      prev.map((c) =>
                        c.id === category.id
                          ? {
                              ...c,
                              iconKey: option.key,
                              icon: option.icon,
                              tint: option.tint,
                              bar: option.bar,
                            }
                          : c,
                      ),
                    )
                  }
                />
                <PillInput
                  value={category.name}
                  onChange={(name) =>
                    setFlexibleCategories((prev) =>
                      prev.map((c) => (c.id === category.id ? { ...c, name } : c)),
                    )
                  }
                  placeholder="Категория"
                  className="min-w-0 flex-1"
                />
                <PillInput
                  inputRef={index === 0 ? firstCategoryAmountRef : undefined}
                  dataTour={index === 0 ? "budget-first-category-amount" : undefined}
                  value={category.amount}
                  onChange={(amount) => handleCategoryAmountChange(category.id, amount)}
                  placeholder="0"
                  numericOnly
                  className="w-24 text-right"
                />
                <button
                  type="button"
                  onClick={() =>
                    setFlexibleCategories((prev) => prev.filter((c) => c.id !== category.id))
                  }
                  aria-label="Удалить категорию"
                  className="flex size-9 shrink-0 items-center justify-center rounded-full border border-primary/20 text-sm font-bold text-muted-foreground"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={addFlexibleCategory}
            className="mt-3 flex w-full items-center justify-center rounded-block-sm border-2 border-dashed border-primary/30 py-2.5 text-sm font-bold text-primary"
          >
            + Добавить категорию
          </button>
        </section>

        {primaryGoal && (
          <section className="mt-4 flex items-center gap-3 rounded-block bg-accent/80 p-4 shadow-sm shadow-primary/5">
            <div className="min-w-0 flex-1">
              <p className="font-serif text-sm font-bold text-foreground">На мечту ✈️</p>
              <p className="truncate text-xs text-muted-foreground">{primaryGoal.name}</p>
            </div>
            <p
              className={`shrink-0 font-serif text-xl font-bold ${
                overspent ? "text-muted-foreground" : "text-primary"
              }`}
            >
              {formatRub(overspent ? 0 : dreamAmount)}
            </p>
          </section>
        )}
      </div>

      <div className="absolute inset-x-0 bottom-0 border-t border-border/60 bg-card/95 px-5 pb-8 pt-4 backdrop-blur">
        <button
          type="button"
          disabled={overspent || incomeTotal <= 0}
          onClick={handleApply}
          className="w-full rounded-block-sm bg-primary py-4 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/30 transition-transform active:scale-[0.98] disabled:opacity-40"
        >
          Применить бюджет
        </button>
      </div>

      <BudgetPlannerCoachMark
        introTargetRef={budgetIntroRef}
        dismissed={coachMarkDismissed}
        onDismiss={dismissCoachMark}
      />
    </div>
  )
}
