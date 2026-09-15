"use client"

import { useEffect, useMemo, useState } from "react"
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { useFinance } from "@/context/finance-context"
import { getCategorySpent, getDailySpendingMap, getMonthlySummary } from "@/lib/calculations"
import { formatMoney } from "@/lib/format"
import {
  getAvailablePeriodKeys,
  getPeriodBounds,
  getPeriodLabelFromKey,
  getPeriodStartDate,
} from "@/lib/period"
import { getPeriodsWithExcludedExpenses } from "@/lib/period-reset"

const FALLBACK_COLORS = {
  spent: "oklch(0.78 0.115 355)",
  income: "oklch(0.7 0.12 160)",
}

function useComparisonChartColors() {
  const [colors, setColors] = useState(FALLBACK_COLORS)

  useEffect(() => {
    const root = getComputedStyle(document.documentElement)
    setColors({
      spent: root.getPropertyValue("--chart-1").trim() || FALLBACK_COLORS.spent,
      income: root.getPropertyValue("--chart-5").trim() || FALLBACK_COLORS.income,
    })
  }, [])

  return colors
}

const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
]

export function AnalyticsScreen() {
  const { data, periodKey, periodLabel, summary, setActiveTab } = useFinance()
  const currency = data.settings.currency
  const comparisonColors = useComparisonChartColors()
  const [selectedPeriodKey, setSelectedPeriodKey] = useState(periodKey)
  const [selectedDayIso, setSelectedDayIso] = useState<string | null>(null)

  useEffect(() => {
    setSelectedPeriodKey(periodKey)
    setSelectedDayIso(null)
  }, [periodKey])

  const periodKeys = useMemo(
    () =>
      getAvailablePeriodKeys(
        data.transactions.map((tx) => tx.date),
        data.archives.map((archive) => archive.periodKey),
        periodKey,
        data.settings.monthStartDay,
      ),
    [data.transactions, data.archives, periodKey, data.settings.monthStartDay],
  )

  const activeKey = periodKeys.includes(selectedPeriodKey) ? selectedPeriodKey : periodKey
  const activePeriodLabel = getPeriodLabelFromKey(activeKey, data.settings.monthStartDay)
  const activeSummary = useMemo(
    () =>
      getMonthlySummary(
        data.transactions,
        data.categories,
        activeKey,
        data.settings.monthStartDay,
        data.budgetPlan,
      ),
    [data.transactions, data.categories, activeKey, data.settings.monthStartDay, data.budgetPlan],
  )
  const excludedPeriods = useMemo(() => getPeriodsWithExcludedExpenses(data), [data])
  const activePeriodHasExcluded = excludedPeriods.includes(activeKey)

  const pieData = data.categories
    .map((category) => ({
      name: category.name,
      value: getCategorySpent(
        data.transactions,
        category.id,
        activeKey,
        data.settings.monthStartDay,
      ),
      color: category.bar,
    }))
    .filter((item) => item.value > 0)

  const monthlyComparison = [
    ...data.archives.slice(-5).map((archive) => ({
      name: archive.label.split(" ")[0],
      spent: archive.spent,
      income: archive.income,
    })),
    {
      name: periodLabel.split(" ")[0],
      spent: summary.spent,
      income: summary.income,
    },
  ]

  const { start, end } = getPeriodBounds(
    getPeriodStartDate(activeKey, data.settings.monthStartDay),
    data.settings.monthStartDay,
  )
  const dailyMap = getDailySpendingMap(
    data.transactions,
    activeKey,
    data.settings.monthStartDay,
  )
  const maxDaily = Math.max(...dailyMap.values(), 1)
  const dailyTotal = Array.from(dailyMap.values()).reduce((sum, amount) => sum + amount, 0)

  const heatmapDays: { iso: string; day: number; intensity: number; amount: number }[] = []
  const cursor = new Date(start)
  while (cursor <= end) {
    const iso = cursor.toISOString().slice(0, 10)
    const amount = dailyMap.get(iso) ?? 0
    heatmapDays.push({
      iso,
      day: cursor.getDate(),
      intensity: amount / maxDaily,
      amount,
    })
    cursor.setDate(cursor.getDate() + 1)
  }

  const selectedDay = heatmapDays.find((item) => item.iso === selectedDayIso) ?? null

  return (
    <>
      <header className="px-5 pb-2 pt-4">
        <h1 className="font-serif text-2xl font-bold text-foreground">Аналитика</h1>
        <p className="mt-1 text-sm text-muted-foreground">Осмысление и сравнение</p>
      </header>

      <div className="flex-1 overflow-y-auto px-5 pb-28">
        <div className="mb-4">
          <p className="mb-2 text-xs font-semibold text-muted-foreground">Период</p>
          <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {periodKeys.map((key) => {
              const selected = key === activeKey
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    setSelectedPeriodKey(key)
                    setSelectedDayIso(null)
                  }}
                  className={`shrink-0 rounded-full px-4 py-2 text-xs font-bold transition-colors ${
                    selected
                      ? "bg-primary text-primary-foreground shadow-sm shadow-primary/25"
                      : "bg-card text-muted-foreground shadow-sm shadow-primary/5"
                  }`}
                >
                  {getPeriodLabelFromKey(key, data.settings.monthStartDay)}
                </button>
              )
            })}
          </div>
        </div>

        <section className="rounded-block bg-card p-4 shadow-sm shadow-primary/5">
          <h2 className="mb-3 font-serif text-base font-bold">Расходы по категориям</h2>
          {pieData.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {activePeriodHasExcluded
                ? "Траты обнулены — восстановите их в Настройках → Месяц"
                : `Нет расходов за ${activePeriodLabel.toLowerCase()}`}
            </p>
          ) : (
            <>
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={52}
                      outerRadius={78}
                      paddingAngle={3}
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={entry.name} fill={entry.color ?? CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => formatMoney(Number(value), currency)} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-2 flex flex-col gap-1.5">
                {pieData.map((item) => (
                  <div key={item.name} className="flex items-center justify-between text-xs">
                    <span className="font-medium">{item.name}</span>
                    <span className="font-bold">{formatMoney(item.value, currency)}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </section>

        <section className="mt-4 rounded-block bg-card p-4 shadow-sm shadow-primary/5">
          <h2 className="mb-3 font-serif text-base font-bold">Сравнение по месяцам</h2>
          <div className="mb-3 flex items-center justify-center gap-6 text-xs">
            <span className="flex items-center gap-1.5 font-semibold text-foreground">
              <span
                className="size-3 rounded-sm"
                style={{ backgroundColor: comparisonColors.spent }}
              />
              Расходы
            </span>
            <span className="flex items-center gap-1.5 font-semibold text-foreground">
              <span
                className="size-3 rounded-sm"
                style={{ backgroundColor: comparisonColors.income }}
              />
              Доход
            </span>
          </div>
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyComparison} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: "currentColor" }} />
                <YAxis tick={{ fontSize: 11, fill: "currentColor" }} width={42} />
                <Tooltip
                  formatter={(value, name) => [
                    formatMoney(Number(value), currency),
                    name === "spent" ? "Расходы" : "Доход",
                  ]}
                  labelFormatter={(label) => `Период: ${label}`}
                  contentStyle={{
                    borderRadius: "12px",
                    border: "1px solid var(--border)",
                    background: "var(--card)",
                  }}
                />
                <Bar
                  dataKey="spent"
                  name="spent"
                  fill={comparisonColors.spent}
                  radius={[6, 6, 0, 0]}
                />
                <Bar
                  dataKey="income"
                  name="income"
                  fill={comparisonColors.income}
                  radius={[6, 6, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="mt-4 rounded-block bg-card p-4 shadow-sm shadow-primary/5">
          <h2 className="mb-1 font-serif text-base font-bold">Траты по дням</h2>
          <p className="mb-3 text-xs text-muted-foreground">Нажмите на день, чтобы увидеть сумму</p>
          {dailyTotal === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              {activePeriodHasExcluded ? (
                <>
                  <p>Траты за этот период обнулены.</p>
                  <button
                    type="button"
                    onClick={() => setActiveTab("settings")}
                    className="mt-3 text-sm font-bold text-primary"
                  >
                    Восстановить в настройках →
                  </button>
                </>
              ) : (
                <p>Нет трат за {activePeriodLabel.toLowerCase()}</p>
              )}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-7 gap-1.5">
                {heatmapDays.map((item) => {
                  const selected = item.iso === selectedDayIso
                  return (
                    <button
                      key={item.iso}
                      type="button"
                      onClick={() =>
                        setSelectedDayIso((current) => (current === item.iso ? null : item.iso))
                      }
                      className={`flex aspect-square items-center justify-center rounded-lg text-[10px] font-semibold transition-transform active:scale-95 ${
                        selected ? "ring-2 ring-primary ring-offset-2 ring-offset-card" : ""
                      }`}
                      style={{
                        backgroundColor: `color-mix(in oklch, var(--primary) ${Math.round(12 + item.intensity * 75)}%, transparent)`,
                      }}
                    >
                      {item.day}
                    </button>
                  )
                })}
              </div>
              {selectedDay ? (
                <p className="mt-3 text-center text-sm font-semibold text-foreground">
                  {new Date(selectedDay.iso).toLocaleDateString("ru-RU", {
                    day: "numeric",
                    month: "long",
                  })}
                  {": "}
                  {formatMoney(selectedDay.amount, currency)}
                </p>
              ) : null}
            </>
          )}
        </section>

        <section className="mt-4 rounded-block bg-card p-4 shadow-sm shadow-primary/5">
          <h2 className="mb-3 font-serif text-base font-bold">Баланс месяца</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Доход</span>
              <span className="font-bold text-[color:var(--success)]">
                {formatMoney(activeSummary.income, currency)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Расходы</span>
              <span className="font-bold text-destructive">
                {formatMoney(activeSummary.spent, currency)}
              </span>
            </div>
            <div className="flex justify-between border-t border-border pt-2">
              <span className="font-semibold">Остаток</span>
              <span className="font-serif text-lg font-bold">
                {formatMoney(activeSummary.left, currency)}
              </span>
            </div>
          </div>
        </section>
      </div>
    </>
  )
}
