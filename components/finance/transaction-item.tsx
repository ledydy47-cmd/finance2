import { Trash2 } from "lucide-react"
import { CategoryIconBadge } from "@/components/finance/category-icon"
import type { TransactionType } from "@/lib/types"

interface TransactionItemProps {
  icon: string
  iconImage?: string
  title: string
  category: string
  amount: number
  type?: TransactionType
  tint: string
  bar: string
  onDelete?: () => void
}

function formatRub(value: number) {
  return `${value.toLocaleString("ru-RU")} ₽`
}

export function TransactionItem({
  icon,
  iconImage,
  title,
  category,
  amount,
  type = "expense",
  tint,
  bar,
  onDelete,
}: TransactionItemProps) {
  const prefix = type === "income" ? "+" : "-"

  return (
    <div className="flex items-center gap-3 py-2.5">
      <CategoryIconBadge icon={icon} iconImage={iconImage} bar={bar} tint={tint} size="sm" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-card-foreground">{title}</p>
        <p className="truncate text-xs text-muted-foreground">{category}</p>
      </div>
      <p
        className={`shrink-0 text-sm font-bold ${
          type === "income" ? "text-[color:var(--success)]" : "text-card-foreground"
        }`}
      >
        {prefix}
        {formatRub(amount)}
      </p>
      {onDelete && (
        <button
          type="button"
          onClick={onDelete}
          aria-label="Удалить операцию"
          className="flex size-8 shrink-0 items-center justify-center rounded-full text-destructive/80 transition-colors hover:bg-destructive/10"
        >
          <Trash2 className="size-4" strokeWidth={2.2} />
        </button>
      )}
    </div>
  )
}
