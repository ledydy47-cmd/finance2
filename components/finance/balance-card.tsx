import { TrendingDown, Wallet } from "lucide-react"

interface BalanceCardProps {
  left: number
  income: number
  spent: number
}

function formatRub(value: number) {
  return `${value.toLocaleString("ru-RU")} ₽`
}

export function BalanceCard({ left, income, spent }: BalanceCardProps) {
  return (
    <div className="relative overflow-hidden rounded-block bg-primary p-6 text-primary-foreground shadow-lg shadow-primary/25">
      <div
        aria-hidden="true"
        className="absolute -right-8 -top-10 size-40 rounded-full bg-primary-foreground/10"
      />
      <div
        aria-hidden="true"
        className="absolute -bottom-12 -left-6 size-32 rounded-full bg-primary-foreground/10"
      />

      <div className="relative">
        <div className="flex items-center gap-2 text-primary-foreground/85">
          <Wallet className="size-4" strokeWidth={2.4} />
          <p className="text-sm font-medium">Осталось в этом месяце</p>
        </div>

        <p className="mt-2 font-serif text-4xl font-bold tracking-tight">{formatRub(left)}</p>

        <div className="mt-5 flex gap-3">
          <div className="flex-1 rounded-block-sm bg-primary-foreground/15 px-4 py-3">
            <p className="text-xs font-medium text-primary-foreground/80">Доход</p>
            <p className="mt-0.5 text-base font-bold">{formatRub(income)}</p>
          </div>
          <div className="flex-1 rounded-block-sm bg-primary-foreground/15 px-4 py-3">
            <p className="flex items-center gap-1 text-xs font-medium text-primary-foreground/80">
              <TrendingDown className="size-3.5" strokeWidth={2.6} />
              Потрачено
            </p>
            <p className="mt-0.5 text-base font-bold">{formatRub(spent)}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
