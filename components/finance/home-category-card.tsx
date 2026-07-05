"use client"

import { Pencil } from "lucide-react"
import { CategoryIconBadge } from "@/components/finance/category-icon"
import { formatDaysLeftLabel, formatOperationsCount, formatRub } from "@/lib/format"

interface HomeCategoryCardProps {
  categoryId: string
  icon: string
  name: string
  spent: number
  budget: number
  transactionCount: number
  daysLeft: number
  tint: string
  bar: string
  onQuickAdd?: (categoryId: string) => void
}

export function HomeCategoryCard({
  categoryId,
  icon,
  name,
  spent,
  budget,
  transactionCount,
  daysLeft,
  tint,
  bar,
  onQuickAdd,
}: HomeCategoryCardProps) {
  const overBudget = budget > 0 && spent > budget
  const remaining = budget - spent
  const percent =
    budget > 0 ? Math.min(100, Math.round((spent / budget) * 100)) : spent > 0 ? 100 : 0

  return (
    <div className="rounded-block bg-card p-4 shadow-sm shadow-primary/5">
      <div className="flex items-center gap-3">
        <CategoryIconBadge icon={icon} bar={bar} tint={tint} size="md" />
        <p className="min-w-0 flex-1 truncate font-serif text-[15px] font-semibold text-card-foreground">
          {name}
        </p>
        {onQuickAdd && (
          <button
            type="button"
            onClick={() => onQuickAdd(categoryId)}
            aria-label={`Добавить расход в «${name}»`}
            className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary transition-transform active:scale-95"
          >
            <Pencil className="size-4" strokeWidth={2.2} />
          </button>
        )}
      </div>

      <p className="mt-3 text-base leading-snug">
        <span className="font-serif text-xl font-bold text-card-foreground">{formatRub(spent)}</span>
        <span className="font-medium text-muted-foreground"> / {formatRub(budget)}</span>
        {overBudget ? (
          <span className="font-semibold text-destructive">
            {" "}
            · превышение на {formatRub(spent - budget)}
          </span>
        ) : (
          <span className="font-semibold text-[color:var(--success)]">
            {" "}
            · осталось {formatRub(Math.max(0, remaining))}
          </span>
        )}
      </p>

      <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-secondary">
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{
            width: `${percent}%`,
            backgroundColor: overBudget ? "var(--destructive)" : bar,
          }}
        />
      </div>

      <div className="mt-3 flex items-center justify-between gap-2 text-xs font-medium text-muted-foreground">
        <span>{formatOperationsCount(transactionCount)}</span>
        <span>{formatDaysLeftLabel(daysLeft)}</span>
      </div>
    </div>
  )
}
