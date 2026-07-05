"use client"

import { ThemePreviewCard } from "@/components/theme/theme-preview-card"
import { ThemeSwatchGrid } from "@/components/theme/theme-swatch-grid"
import { useTheme } from "@/components/theme/theme-applier"

interface ThemePickerProps {
  compact?: boolean
  showPreview?: boolean
}

export function ThemePicker({ compact, showPreview = true }: ThemePickerProps) {
  const { themeId, setTheme } = useTheme()

  return (
    <div className={compact ? "space-y-3" : "space-y-5"}>
      {showPreview && !compact && <ThemePreviewCard />}
      <ThemeSwatchGrid selected={themeId} onSelect={setTheme} compact={compact} />
    </div>
  )
}

export function OnboardingThemeStep() {
  return (
    <div className="flex w-full flex-col items-center text-center">
      <div className="mb-4 flex size-16 items-center justify-center rounded-full bg-primary/15 text-3xl">
        🎨
      </div>
      <h2 className="font-serif text-2xl font-bold text-foreground">Выбери свою тему 🎨</h2>
      <p className="mt-2 text-sm text-muted-foreground">Настрой приложение под себя</p>
      <div className="mt-5 w-full">
        <ThemePicker />
      </div>
    </div>
  )
}
