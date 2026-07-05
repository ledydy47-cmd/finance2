export type ThemeId = "pink" | "mint" | "lavender" | "blue" | "neutral"

export interface ThemePalette {
  id: ThemeId
  name: string
  swatch: string
  vars: Record<string, string>
}

function baseTheme(
  id: ThemeId,
  name: string,
  swatch: string,
  hue: number,
  chromaPrimary = 0.115,
  chromaSecondary = 0.025,
): ThemePalette {
  return {
    id,
    name,
    swatch,
    vars: {
      background: "oklch(0.98 0.012 40)",
      foreground: `oklch(0.32 0.03 ${hue})`,
      card: "oklch(1 0.004 60)",
      "card-foreground": `oklch(0.32 0.03 ${hue})`,
      popover: "oklch(1 0.004 60)",
      "popover-foreground": `oklch(0.32 0.03 ${hue})`,
      primary: `oklch(0.78 ${chromaPrimary} ${hue})`,
      "primary-foreground": `oklch(0.99 0.01 ${hue})`,
      secondary: `oklch(0.95 ${chromaSecondary} ${hue})`,
      "secondary-foreground": `oklch(0.45 0.06 ${hue})`,
      muted: "oklch(0.96 0.012 40)",
      "muted-foreground": `oklch(0.6 0.03 ${hue})`,
      accent: `oklch(0.93 0.04 ${hue})`,
      "accent-foreground": `oklch(0.45 0.06 ${hue})`,
      destructive: "oklch(0.63 0.19 20)",
      border: `oklch(0.92 0.02 ${hue})`,
      input: `oklch(0.92 0.02 ${hue})`,
      ring: `oklch(0.78 ${chromaPrimary} ${hue})`,
      success: "oklch(0.7 0.12 160)",
      "success-foreground": "oklch(0.99 0.01 160)",
      "chart-1": `oklch(0.78 ${chromaPrimary} ${hue})`,
      "chart-2": "oklch(0.8 0.09 40)",
      "chart-3": "oklch(0.75 0.09 300)",
      "chart-4": "oklch(0.8 0.1 200)",
      "chart-5": "oklch(0.7 0.12 160)",
    },
  }
}

export const THEMES: Record<ThemeId, ThemePalette> = {
  pink: baseTheme("pink", "Розовая", "oklch(0.78 0.115 355)", 355),
  mint: baseTheme("mint", "Мятная", "oklch(0.76 0.11 165)", 165, 0.11, 0.03),
  lavender: baseTheme("lavender", "Лавандовая", "oklch(0.76 0.1 295)", 295, 0.1, 0.028),
  blue: baseTheme("blue", "Голубая", "oklch(0.76 0.1 230)", 230, 0.1, 0.028),
  neutral: baseTheme("neutral", "Нейтральная", "oklch(0.72 0.04 70)", 70, 0.04, 0.015),
}

export const THEME_LIST = Object.values(THEMES)

export const DEFAULT_THEME_ID: ThemeId = "lavender"

export function applyTheme(themeId: ThemeId) {
  if (typeof document === "undefined") return
  const theme = THEMES[themeId] ?? THEMES.lavender
  const root = document.documentElement
  root.dataset.theme = themeId
  for (const [key, value] of Object.entries(theme.vars)) {
    root.style.setProperty(`--${key}`, value)
  }
}

export function isThemeId(value: string): value is ThemeId {
  return value in THEMES
}
