"use client"

import { CategoryIconBadge } from "@/components/finance/category-icon"
import { CATEGORY_ICON_OPTIONS, type CategoryIconOption } from "@/lib/category-icons"

interface CategoryIconPickerProps {
  value: Pick<CategoryIconOption, "icon" | "iconImage" | "tint" | "bar">
  onChange: (option: CategoryIconOption) => void
  open: boolean
  onOpenChange: (open: boolean) => void
  size?: "sm" | "md"
}

export function CategoryIconPicker({
  value,
  onChange,
  open,
  onOpenChange,
  size = "sm",
}: CategoryIconPickerProps) {
  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={() => onOpenChange(!open)}
        aria-label="Выбрать иконку"
        className="rounded-full transition-transform active:scale-95"
      >
        <CategoryIconBadge
          icon={value.icon}
          iconImage={value.iconImage}
          bar={value.bar}
          tint={value.tint}
          size={size}
        />
      </button>
      {open && (
        <>
          <button
            type="button"
            aria-label="Закрыть"
            className="fixed inset-0 z-10"
            onClick={() => onOpenChange(false)}
          />
          <div className="absolute left-0 top-full z-20 mt-2 grid w-[220px] grid-cols-3 gap-2 rounded-block-sm border border-border bg-card p-2 shadow-lg shadow-primary/10">
            {CATEGORY_ICON_OPTIONS.map((option) => (
              <button
                key={option.key}
                type="button"
                onClick={() => {
                  onChange(option)
                  onOpenChange(false)
                }}
                className="flex flex-col items-center gap-1 rounded-block-sm p-1.5 transition-colors hover:bg-primary/10"
              >
                <CategoryIconBadge
                  icon={option.icon}
                  iconImage={option.iconImage}
                  bar={option.bar}
                  tint={option.tint}
                  size="sm"
                />
                <span className="text-[9px] font-semibold text-muted-foreground">{option.label}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
