import { CategoryIconBadge } from "@/components/finance/category-icon"

interface CategoryCardProps {
  icon: string
  name: string
  spent: number
  budget: number
  tint: string
  bar: string
}

function formatRub(value: number) {
  return `${value.toLocaleString("ru-RU")} ₽`
}

export function CategoryCard({
  icon,
  name,
  spent,
  budget,
  tint,
  bar,
}: CategoryCardProps) {
  const percent = Math.min(100, Math.round((spent / budget) * 100))
  const remaining = Math.max(0, budget - spent)
  const overBudget = spent > budget

  return (
    <div className="rounded-block bg-card p-4 shadow-sm shadow-primary/5">
      <div className="flex items-center gap-3">
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
      </div>
    </div>
  )
}
