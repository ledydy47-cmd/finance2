"use client"

import { Pencil } from "lucide-react"
import { CategoryIconBadge } from "@/components/finance/category-icon"

interface CategoryCardProps {
  categoryId: string
  icon: string
  name: string
  spent: number
  budget: number
  tint: string
  bar: string
  onQuickAdd?: (categoryId: string) => void
}

function formatRub(value: number) {
  return `${value.toLocaleString("ru-RU")} ₽`
}

export function CategoryCard({
  categoryId,
  icon,
  name,
  spent,
  budget,
  tint,
  bar,
  onQuickAdd,
}: CategoryCardProps) {
  const percent = budget > 0 ? Math.min(100, Math.round((spent / budget) * 100)) : 0
  const remaining = Math.max(0, budget - spent)
  const overBudget = budget > 0 && spent > budget

  return (
    <div className="rounded-block bg-card p-4 shadow-sm shadow-primary/5">
      <div className="flex items-start gap-3">
        <CategoryIconBadge icon={icon} bar={bar} tint={tint} size="md" />

        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <p className="truncate font-serif text-[15px] font-semibold text-card-foreground">{name}</p>
            <p className="shrink-0 text-xs font-medium text-muted-foreground">
              <span className="text-card-foreground">{formatRub(spent)}</span>
              {" / "}
              {formatRub(budget)}
            </p>
          </div>

          <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${percent}%`,
                backgroundColor: overBudget ? "var(--destructive)" : bar,
              }}
            />
          </div>

          <p className="mt-1.5 text-xs font-medium">
            {overBudget ? (
              <span className="text-destructive">Превышение на {formatRub(spent - budget)}</span>
            ) : (
              <span className="text-[color:var(--success)]">Осталось {formatRub(remaining)}</span>
            )}
          </p>
        </div>

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
    </div>
  )
}
