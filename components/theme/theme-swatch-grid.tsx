"use client"

import { THEME_LIST, type ThemeId } from "@/lib/themes"

interface ThemeSwatchGridProps {
  selected: ThemeId
  onSelect: (id: ThemeId) => void
  compact?: boolean
}

export function ThemeSwatchGrid({ selected, onSelect, compact }: ThemeSwatchGridProps) {
  return (
    <div className={`grid grid-cols-2 ${compact ? "gap-2" : "gap-3"}`}>
      {THEME_LIST.map((theme) => {
        const isSelected = selected === theme.id
        return (
          <button
            key={theme.id}
            type="button"
            onClick={() => onSelect(theme.id)}
            className={`flex items-center gap-3 rounded-block-sm px-3 py-3 text-left transition-all ${
              isSelected
                ? "bg-primary/15 ring-2 ring-primary"
                : "bg-card shadow-sm shadow-primary/5"
            }`}
          >
            <span
              className="size-9 shrink-0 rounded-full shadow-inner transition-transform active:scale-95"
              style={{ backgroundColor: theme.swatch }}
            />
            <span className="text-sm font-semibold text-foreground">{theme.name}</span>
          </button>
        )
      })}
    </div>
  )
}
