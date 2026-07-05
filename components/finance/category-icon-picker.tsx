"use client"

import { useState } from "react"
import { CategoryIconBadge } from "@/components/finance/category-icon"
import {
  CATEGORY_ICON_OPTIONS,
  customIconOption,
  extractFirstEmoji,
  type CategoryIconOption,
} from "@/lib/category-icons"

interface CategoryIconPickerProps {
  value: Pick<CategoryIconOption, "icon" | "tint" | "bar">
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
  const [customEmojiInput, setCustomEmojiInput] = useState("")

  function applyCustomEmoji() {
    const emoji = extractFirstEmoji(customEmojiInput)
    if (!emoji) return
    onChange(customIconOption(emoji, { tint: value.tint, bar: value.bar }))
    setCustomEmojiInput("")
    onOpenChange(false)
  }

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={() => onOpenChange(!open)}
        aria-label="Выбрать иконку"
        className="rounded-full transition-transform active:scale-95"
      >
        <CategoryIconBadge icon={value.icon} bar={value.bar} tint={value.tint} size={size} />
      </button>
      {open && (
        <>
          <button
            type="button"
            aria-label="Закрыть"
            className="fixed inset-0 z-10"
            onClick={() => onOpenChange(false)}
          />
          <div className="absolute left-0 top-full z-20 mt-2 w-[240px] rounded-block-sm border border-border bg-card p-2 shadow-lg shadow-primary/10">
            <div className="grid grid-cols-3 gap-2">
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
                    bar={option.bar}
                    tint={option.tint}
                    size="sm"
                  />
                  <span className="text-[9px] font-semibold text-muted-foreground">{option.label}</span>
                </button>
              ))}
            </div>
            <div className="mt-2 border-t border-border/60 pt-2">
              <p className="mb-1.5 text-[10px] font-semibold text-muted-foreground">Своя эмодзи</p>
              <div className="flex gap-1.5">
                <input
                  type="text"
                  value={customEmojiInput}
                  onChange={(e) => setCustomEmojiInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault()
                      applyCustomEmoji()
                    }
                  }}
                  placeholder="🎯"
                  className="min-w-0 flex-1 rounded-block-inner border border-border bg-background px-2 py-1.5 text-center text-lg outline-none ring-primary focus:ring-2"
                  autoComplete="off"
                />
                <button
                  type="button"
                  onClick={applyCustomEmoji}
                  disabled={!extractFirstEmoji(customEmojiInput)}
                  className="shrink-0 rounded-block-inner bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground disabled:opacity-40"
                >
                  OK
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
