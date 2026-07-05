import { paletteForIndex } from "@/lib/budget-planner"

export const CATEGORY_EMOJI_BY_ID: Record<string, string> = {
  "cat-products": "🛒",
  "cat-cafe": "☕",
  "cat-beauty": "💄",
  "cat-transport": "🚌",
  "cat-market": "🛍️",
  "cat-entertainment": "🎬",
  "cat-rent": "🏠",
  "cat-utilities": "💡",
}

export interface CategoryIconOption {
  key: string
  label: string
  icon: string
  tint: string
  bar: string
}

const ICON_KEYS = [
  "cat-products",
  "cat-cafe",
  "cat-beauty",
  "cat-transport",
  "cat-market",
] as const

const ICON_LABELS: Record<(typeof ICON_KEYS)[number], string> = {
  "cat-products": "Продукты",
  "cat-cafe": "Кафе",
  "cat-beauty": "Косметика",
  "cat-transport": "Транспорт",
  "cat-market": "Маркетплейсы",
}

export const CATEGORY_ICON_OPTIONS: CategoryIconOption[] = ICON_KEYS.map((key, index) => {
  const palette = paletteForIndex(index)
  return {
    key,
    label: ICON_LABELS[key],
    icon: CATEGORY_EMOJI_BY_ID[key],
    tint: palette.tint,
    bar: palette.bar,
  }
})

export function getCategoryIconOption(key: string): CategoryIconOption {
  return CATEGORY_ICON_OPTIONS.find((o) => o.key === key) ?? CATEGORY_ICON_OPTIONS[0]
}

export function iconOptionForCategoryId(categoryId: string): CategoryIconOption {
  const fromKey = CATEGORY_ICON_OPTIONS.find((o) => o.key === categoryId)
  if (fromKey) return fromKey
  const hash = categoryId.split("").reduce((sum, c) => sum + c.charCodeAt(0), 0)
  return CATEGORY_ICON_OPTIONS[hash % CATEGORY_ICON_OPTIONS.length]
}

export function emojiForCategoryId(categoryId: string, fallbackIcon?: string): string {
  return CATEGORY_EMOJI_BY_ID[categoryId] ?? fallbackIcon ?? "✨"
}

const EMOJI_PATTERN = /\p{Extended_Pictographic}/u

export function extractFirstEmoji(text: string): string | null {
  const match = text.match(EMOJI_PATTERN)
  return match?.[0] ?? null
}

export function customIconOption(
  icon: string,
  base: Pick<CategoryIconOption, "tint" | "bar">,
): CategoryIconOption {
  return {
    key: "custom",
    label: "Своё",
    icon,
    tint: base.tint,
    bar: base.bar,
  }
}
