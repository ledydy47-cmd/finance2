"use client"

import { useFinance } from "@/context/finance-context"
import { formatRelativeDay } from "@/lib/format"
import { TransactionItem } from "@/components/finance/transaction-item"
import type { Transaction } from "@/lib/types"

interface TransactionsListProps {
  transactions: Transaction[]
  emptyMessage?: string
  deletable?: boolean
}

export function TransactionsList({
  transactions,
  emptyMessage = "Нет операций за этот период",
  deletable = true,
}: TransactionsListProps) {
  const { getCategoryById, deleteTransaction } = useFinance()

  const sorted = [...transactions].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  )

  if (sorted.length === 0) {
    return (
      <div className="rounded-block bg-card px-4 py-8 text-center shadow-sm shadow-primary/5">
        <p className="text-sm text-muted-foreground">{emptyMessage}</p>
      </div>
    )
  }

  function handleDelete(tx: Transaction) {
    const label = tx.note || (tx.type === "income" ? "Доход" : "Расход")
    if (confirm(`Удалить операцию «${label}»?`)) {
      deleteTransaction(tx.id)
    }
  }

  return (
    <div className="divide-y divide-border/60 rounded-block bg-card px-4 py-1 shadow-sm shadow-primary/5">
      {sorted.map((tx) => {
        const category = getCategoryById(tx.categoryId)
        return (
          <TransactionItem
            key={tx.id}
            icon={category?.icon ?? "✨"}
            title={tx.note || (tx.type === "income" ? "Доход" : "Расход")}
            category={
              category
                ? `${category.name} · ${formatRelativeDay(tx.date)}`
                : formatRelativeDay(tx.date)
            }
            amount={tx.amount}
            type={tx.type}
            tint={category?.tint ?? "var(--accent)"}
            bar={category?.bar ?? "var(--primary)"}
            onDelete={deletable ? () => handleDelete(tx) : undefined}
          />
        )
      })}
    </div>
  )
}
