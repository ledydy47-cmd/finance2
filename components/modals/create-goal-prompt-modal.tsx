"use client"

interface CreateGoalPromptModalProps {
  open: boolean
  onCreate: () => void
  onDismiss: () => void
}

export function CreateGoalPromptModal({ open, onCreate, onDismiss }: CreateGoalPromptModalProps) {
  if (!open) return null

  return (
    <div className="absolute inset-0 z-[88] flex items-center justify-center bg-foreground/35 p-5 backdrop-blur-sm">
      <div className="w-full max-w-sm animate-in fade-in zoom-in-95 rounded-block bg-card p-6 shadow-xl shadow-primary/15 duration-300">
        <h2 className="text-center font-serif text-xl font-bold text-foreground">
          Создать новую цель?
        </h2>
        <p className="mt-2 text-center text-sm text-muted-foreground">
          Поставь следующую мечту и продолжай копить 💗
        </p>
        <div className="mt-5 flex flex-col gap-2.5">
          <button
            type="button"
            onClick={onCreate}
            className="w-full rounded-block-sm bg-primary py-3.5 text-sm font-bold text-primary-foreground shadow-sm shadow-primary/25"
          >
            Создать цель
          </button>
          <button
            type="button"
            onClick={onDismiss}
            className="w-full rounded-block-sm py-3 text-sm font-semibold text-muted-foreground"
          >
            Не сейчас
          </button>
        </div>
      </div>
    </div>
  )
}
