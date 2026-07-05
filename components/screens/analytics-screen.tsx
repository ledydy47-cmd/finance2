"use client"

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
import { getCategorySpent, getDailySpendingMap } from "@/lib/calculations"
import { formatRub } from "@/lib/format"
import { getPeriodBounds } from "@/lib/period"

const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
]

export function AnalyticsScreen() {
  const { data, periodKey, periodLabel, summary } = useFinance()

  const pieData = data.categories
    .map((category) => ({
      name: category.name,
      value: getCategorySpent(
        data.transactions,
        category.id,
        periodKey,
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

  const { start, end } = getPeriodBounds(new Date(), data.settings.monthStartDay)
  const dailyMap = getDailySpendingMap(data.transactions, periodKey, data.settings.monthStartDay)
  const maxDaily = Math.max(...dailyMap.values(), 1)

  const heatmapDays: { day: number; intensity: number; amount: number }[] = []
  const cursor = new Date(start)
  while (cursor <= end) {
    const key = cursor.toISOString().slice(0, 10)
    const amount = dailyMap.get(key) ?? 0
    heatmapDays.push({
      day: cursor.getDate(),
      intensity: amount / maxDaily,
      amount,
    })
    cursor.setDate(cursor.getDate() + 1)
  }

  return (
    <>
      <header className="px-5 pb-2 pt-4">
        <h1 className="font-serif text-2xl font-bold text-foreground">Аналитика</h1>
        <p className="mt-1 text-sm text-muted-foreground">Осмысление и сравнение</p>
      </header>

      <div className="flex-1 overflow-y-auto px-5 pb-28">
        <section className="rounded-block bg-card p-4 shadow-sm shadow-primary/5">
          <h2 className="mb-3 font-serif text-base font-bold">Расходы по категориям</h2>
          {pieData.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Нет расходов в этом месяце</p>
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
                    <Tooltip formatter={(value) => formatRub(Number(value))} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-2 flex flex-col gap-1.5">
                {pieData.map((item) => (
                  <div key={item.name} className="flex items-center justify-between text-xs">
                    <span className="font-medium">{item.name}</span>
                    <span className="font-bold">{formatRub(item.value)}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </section>

        <section className="mt-4 rounded-block bg-card p-4 shadow-sm shadow-primary/5">
          <h2 className="mb-3 font-serif text-base font-bold">Сравнение по месяцам</h2>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyComparison}>
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} width={42} />
                <Tooltip formatter={(value) => formatRub(Number(value))} />
                <Bar dataKey="spent" fill="var(--primary)" radius={[6, 6, 0, 0]} name="Расходы" />
                <Bar dataKey="income" fill="var(--success)" radius={[6, 6, 0, 0]} name="Доход" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="mt-4 rounded-block bg-card p-4 shadow-sm shadow-primary/5">
          <h2 className="mb-3 font-serif text-base font-bold">Траты по дням</h2>
          <div className="grid grid-cols-7 gap-1.5">
            {heatmapDays.map((item) => (
              <div
                key={item.day}
                title={item.amount > 0 ? `${item.day}: ${formatRub(item.amount)}` : `${item.day}`}
                className="flex aspect-square items-center justify-center rounded-lg text-[10px] font-semibold"
                style={{
                  backgroundColor: `color-mix(in oklch, var(--primary) ${Math.round(12 + item.intensity * 75)}%, transparent)`,
                }}
              >
                {item.day}
              </div>
            ))}
          </div>
        </section>

        <section className="mt-4 rounded-block bg-card p-4 shadow-sm shadow-primary/5">
          <h2 className="mb-3 font-serif text-base font-bold">Баланс месяца</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Доход</span>
              <span className="font-bold text-[color:var(--success)]">{formatRub(summary.income)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Расходы</span>
              <span className="font-bold text-destructive">{formatRub(summary.spent)}</span>
            </div>
            <div className="flex justify-between border-t border-border pt-2">
              <span className="font-semibold">Остаток</span>
              <span className="font-serif text-lg font-bold">{formatRub(summary.left)}</span>
            </div>
          </div>
        </section>
      </div>
    </>
  )
}
