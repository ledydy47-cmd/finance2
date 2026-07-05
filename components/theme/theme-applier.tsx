"use client"

import { useEffect } from "react"
import { applyTheme, DEFAULT_THEME_ID, type ThemeId } from "@/lib/themes"
import { useFinance } from "@/context/finance-context"

export function ThemeApplier() {
  const { data } = useFinance()
  const themeId = data.settings.themeId ?? DEFAULT_THEME_ID

  useEffect(() => {
    applyTheme(themeId)
  }, [themeId])

  return null
}

export function useTheme() {
  const { data, setTheme } = useFinance()
  const themeId = data.settings.themeId ?? DEFAULT_THEME_ID

  return {
    themeId,
    setTheme: (id: ThemeId) => {
      setTheme(id)
      applyTheme(id)
    },
  }
}
