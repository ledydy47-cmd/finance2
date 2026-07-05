"use client"

import { useFinance } from "@/context/finance-context"
import { getCategorySpent } from "@/lib/calculations"
import { formatPercent, formatRub } from "@/lib/format"
import { CategoryCard } from "@/components/finance/category-card"

export function StatsScreen() {
  const { data, periodKey, periodLabel, summary } = useFinance()

  const totalBudget = data.categories.reduce((sum, c) => sum + c.monthlyLimit, 0)
  const budgetUsed = formatPercent(summary.spent, totalBudget)
  const onTrack = summary.spent <= totalBudget

  return (
    <>
      <header className="px-5 pb-2 pt-4">
        <h1 className="font-serif text-2xl font-bold text-foreground">Статистика</h1>
        <p className="mt-1 text-sm text-muted-foreground">{periodLabel}</p>
      </header>

      <div className="flex-1 overflow-y-auto px-5 pb-28">
        <div className="rounded-block bg-card p-5 shadow-sm shadow-primary/5">
          <p className="text-sm font-medium text-muted-foreground">Бюджет месяца</p>
          <p className="mt-1 font-serif text-3xl font-bold">
            {formatRub(summary.spent)}
            <span className="text-lg font-medium text-muted-foreground">
              {" "}
              / {formatRub(totalBudget)}
            </span>
          </p>
          <div className="mt-4 h-3 overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${Math.min(100, budgetUsed)}%` }}
            />
          </div>
          <p className={`mt-2 text-sm font-semibold ${onTrack ? "text-[color:var(--success)]" : "text-destructive"}`}>
            {onTrack
              ? `В рамках бюджета · осталось ${formatRub(totalBudget - summary.spent)}`
              : `Перерасход ${formatRub(summary.spent - totalBudget)}`}
          </p>
        </div>

        <section className="mt-6">
          <h2 className="mb-3 font-serif text-lg font-bold">План / факт</h2>
          <div className="flex flex-col gap-3">
            {data.categories.map((category) => {
              const spent = getCategorySpent(
                data.transactions,
                category.id,
                periodKey,
                data.settings.monthStartDay,
              )
              return (
                <CategoryCard
                  key={category.id}
                  icon={category.icon}
                  name={category.name}
                  spent={spent}
                  budget={category.monthlyLimit}
                  tint={category.tint}
                  bar={category.bar}
                />
              )
            })}
          </div>
        </section>

        <div className="mt-6 grid grid-cols-2 gap-3">
          <div className="rounded-block bg-primary/10 p-4">
            <p className="text-xs font-semibold text-muted-foreground">Доход</p>
            <p className="mt-1 font-serif text-xl font-bold text-primary">{formatRub(summary.income)}</p>
          </div>
          <div className="rounded-block bg-accent p-4">
            <p className="text-xs font-semibold text-muted-foreground">Свободно</p>
            <p className="mt-1 font-serif text-xl font-bold">{formatRub(summary.left)}</p>
          </div>
        </div>
      </div>
    </>
  )
}
