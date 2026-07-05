"use client"

import { useEffect, useMemo, useState } from "react"
import { ChevronLeft } from "lucide-react"
import { TransactionsList } from "@/components/finance/transactions-list"
import { useFinance } from "@/context/finance-context"
import { getPeriodTransactions } from "@/lib/calculations"
import { getAvailablePeriodKeys, getPeriodLabelFromKey } from "@/lib/period"

export function TransactionsScreen() {
  const { data, periodKey, showTransactionsList, setShowTransactionsList, isContentLocked } =
    useFinance()
  const [selectedPeriodKey, setSelectedPeriodKey] = useState(periodKey)

  useEffect(() => {
    if (showTransactionsList) setSelectedPeriodKey(periodKey)
  }, [showTransactionsList, periodKey])

  const periodKeys = useMemo(
    () =>
      getAvailablePeriodKeys(
        data.transactions.map((tx) => tx.date),
        data.archives.map((a) => a.periodKey),
        periodKey,
        data.settings.monthStartDay,
      ),
    [data.transactions, data.archives, periodKey, data.settings.monthStartDay],
  )

  const activeKey = periodKeys.includes(selectedPeriodKey) ? selectedPeriodKey : periodKey

  const transactions = useMemo(
    () =>
      getPeriodTransactions(data.transactions, activeKey, data.settings.monthStartDay),
    [data.transactions, activeKey, data.settings.monthStartDay],
  )

  if (!showTransactionsList) return null

  return (
    <div className="absolute inset-0 z-40 flex flex-col bg-background">
      <header className="flex items-center gap-3 px-4 pb-2 pt-4">
        <button
          type="button"
          onClick={() => setShowTransactionsList(false)}
          aria-label="Назад"
          className="flex size-10 items-center justify-center rounded-full bg-card shadow-sm shadow-primary/5"
        >
          <ChevronLeft className="size-5" strokeWidth={2.2} />
        </button>
        <h1 className="font-serif text-xl font-bold text-foreground">Все операции</h1>
      </header>

      <div className="px-5 pb-3">
        <p className="mb-2 text-xs font-semibold text-muted-foreground">Месяц</p>
        <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {periodKeys.map((key) => {
            const selected = key === activeKey
            return (
              <button
                key={key}
                type="button"
                onClick={() => setSelectedPeriodKey(key)}
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

      <div className="flex-1 overflow-y-auto px-5 pb-28">
        <TransactionsList transactions={transactions} deletable={!isContentLocked} />
      </div>
    </div>
  )
}
