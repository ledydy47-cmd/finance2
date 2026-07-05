"use client"

export function ThemePreviewCard() {
  return (
    <div className="rounded-block bg-card p-4 shadow-sm shadow-primary/10">
      <p className="mb-3 text-xs font-semibold text-muted-foreground">Preview</p>
      <div className="rounded-block-sm bg-secondary/60 p-3">
        <div className="flex items-center justify-between gap-2">
          <p className="font-serif text-sm font-bold text-foreground">Моя мечта ✈️</p>
          <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold text-accent-foreground">
            32%
          </span>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">15 000 ₽ из 80 000 ₽</p>
        <div className="mt-2.5 h-2.5 w-full overflow-hidden rounded-full bg-secondary">
          <div className="h-full w-[32%] rounded-full bg-primary transition-colors duration-300" />
        </div>
        <div className="mt-3 flex gap-2">
          <span className="rounded-full bg-primary/15 px-2.5 py-1 text-[10px] font-semibold text-primary">
            Категории
          </span>
          <span className="rounded-full bg-primary px-2.5 py-1 text-[10px] font-semibold text-primary-foreground">
            + Трата
          </span>
        </div>
      </div>
    </div>
  )
}
