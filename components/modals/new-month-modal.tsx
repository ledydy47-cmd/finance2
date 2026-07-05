"use client"

interface NewMonthModalProps {
  open: boolean
  onReset: () => void
  onLater: () => void
}

export function NewMonthModal({ open, onReset, onLater }: NewMonthModalProps) {
  if (!open) return null

  return (
    <div className="absolute inset-0 z-[85] flex items-center justify-center bg-foreground/40 p-5 backdrop-blur-sm">
      <div
        className="w-full max-w-sm animate-in fade-in zoom-in-95 rounded-block bg-card p-6 shadow-xl shadow-primary/15 duration-300"
        role="dialog"
        aria-labelledby="new-month-title"
      >
        <h2 id="new-month-title" className="text-center font-serif text-2xl font-bold text-foreground">
          Начался новый месяц 🌸
        </h2>
        <p className="mt-3 text-center text-sm leading-relaxed text-muted-foreground">
          Обнулить траты по категориям? Категории, доход, обязательные платежи и цели останутся на
          месте.
        </p>
        <div className="mt-6 flex flex-col gap-2.5">
          <button
            type="button"
            onClick={onReset}
            className="w-full rounded-block-sm bg-primary py-3.5 text-sm font-bold text-primary-foreground shadow-sm shadow-primary/25 transition-transform active:scale-[0.98]"
          >
            Обнулить
          </button>
          <button
            type="button"
            onClick={onLater}
            className="w-full rounded-block-sm bg-secondary py-3.5 text-sm font-bold text-secondary-foreground transition-transform active:scale-[0.98]"
          >
            Позже
          </button>
        </div>
        <p className="mt-4 text-center text-[11px] leading-relaxed text-muted-foreground">
          Вы всегда можете сделать это позже в настройках.
        </p>
      </div>
    </div>
  )
}
