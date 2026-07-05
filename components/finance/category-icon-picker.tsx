"use client"

import { useEffect, useRef, useState } from "react"
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
  const customInputRef = useRef<HTMLInputElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return

    const keepInputVisible = () => {
      customInputRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" })
      panelRef.current?.scrollIntoView({ block: "start", behavior: "smooth" })
    }

    const viewport = window.visualViewport
    viewport?.addEventListener("resize", keepInputVisible)
    return () => viewport?.removeEventListener("resize", keepInputVisible)
  }, [open])

  function applyCustomEmoji() {
    const emoji = extractFirstEmoji(customEmojiInput)
    if (!emoji) return
    onChange(customIconOption(emoji, { tint: value.tint, bar: value.bar }))
    setCustomEmojiInput("")
    onOpenChange(false)
  }

  function handleCustomFocus() {
    window.setTimeout(() => {
      customInputRef.current?.scrollIntoView({ block: "center", behavior: "smooth" })
    }, 300)
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
            className="fixed inset-0 z-[80] bg-foreground/25"
            onClick={() => onOpenChange(false)}
          />
          <div
            ref={panelRef}
            className="fixed left-4 right-4 z-[81] max-h-[min(70dvh,420px)] overflow-y-auto overscroll-contain rounded-block-sm border border-border bg-card p-3 shadow-xl shadow-primary/15"
            style={{ top: "max(4.5rem, env(safe-area-inset-top, 0px))" }}
          >
            <div className="mb-3 rounded-block-inner border border-border/60 bg-secondary/40 p-2.5">
              <p className="mb-2 text-xs font-semibold text-muted-foreground">Своя эмодзи</p>
              <div className="flex gap-2">
                <input
                  ref={customInputRef}
                  type="text"
                  value={customEmojiInput}
                  onChange={(e) => setCustomEmojiInput(e.target.value)}
                  onFocus={handleCustomFocus}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault()
                      applyCustomEmoji()
                    }
                  }}
                  placeholder="Введите эмодзи"
                  className="min-w-0 flex-1 rounded-block-inner border border-border bg-background px-3 py-2.5 text-center text-xl outline-none ring-primary focus:ring-2"
                  autoComplete="off"
                />
                <button
                  type="button"
                  onClick={applyCustomEmoji}
                  disabled={!extractFirstEmoji(customEmojiInput)}
                  className="shrink-0 rounded-block-inner bg-primary px-4 py-2.5 text-xs font-bold text-primary-foreground disabled:opacity-40"
                >
                  OK
                </button>
              </div>
            </div>

            <p className="mb-2 text-xs font-semibold text-muted-foreground">Или выберите из списка</p>
            <div className="grid grid-cols-3 gap-2">
              {CATEGORY_ICON_OPTIONS.map((option) => (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => {
                    onChange(option)
                    onOpenChange(false)
                  }}
                  className="flex flex-col items-center gap-1 rounded-block-sm p-2 transition-colors hover:bg-primary/10"
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
          </div>
        </>
      )}
    </div>
  )
}
