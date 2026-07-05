"use client"

import { CategoryIconBadge } from "@/components/finance/category-icon"
import { iconOptionForCategoryId } from "@/lib/category-icons"
import { SETUP_TOUR_CATEGORIES } from "@/lib/setup-tour"

export function GhostCategoryRows() {
  return (
    <div className="flex flex-col gap-3 opacity-40" data-tour="ghost-categories">
      {SETUP_TOUR_CATEGORIES.map((cat) => {
        const icon = iconOptionForCategoryId(cat.id)
        return (
          <div
            key={cat.id}
            className="rounded-block bg-card p-4 shadow-sm shadow-primary/5"
            aria-hidden
          >
            <div className="flex items-center gap-3">
              <CategoryIconBadge
                icon={icon.icon}
                iconImage={icon.iconImage}
                bar={icon.bar}
                tint={icon.tint}
                size="md"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="truncate font-serif text-[15px] font-semibold text-card-foreground">
                    {cat.name}
                  </p>
                  <p className="shrink-0 text-xs font-medium text-muted-foreground">0 ₽ / —</p>
                </div>
                <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-secondary" />
                <p className="mt-1.5 text-xs font-medium text-muted-foreground">Осталось —</p>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
