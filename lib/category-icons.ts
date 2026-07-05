import { paletteForIndex } from "@/lib/budget-planner"

export const CATEGORY_ICON_IMAGES: Record<string, string> = {
  "cat-products": "/images/icons/products.png",
  "cat-cafe": "/images/icons/cafe-delivery.png",
  "cat-beauty": "/images/icons/beauty.png",
  "cat-transport": "/images/icons/transport.png",
  "cat-market": "/images/icons/marketplaces.png",
}

export interface CategoryIconOption {
  key: string
  label: string
  icon: string
  iconImage?: string
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

export const CATEGORY_ICON_OPTIONS: CategoryIconOption[] = ICON_KEYS.map((key, index) => {
  const palette = paletteForIndex(index)
  return {
    key,
    label: key === "cat-products" ? "Продукты" : key === "cat-cafe" ? "Кафе" : key === "cat-beauty" ? "Косметика" : key === "cat-transport" ? "Транспорт" : "Маркетплейсы",
    icon: palette.icon,
    iconImage: CATEGORY_ICON_IMAGES[key],
    tint: palette.tint,
    bar: palette.bar,
  }
})

export function getCategoryIconOption(key: string): CategoryIconOption {
  return (
    CATEGORY_ICON_OPTIONS.find((o) => o.key === key) ??
    CATEGORY_ICON_OPTIONS[0]
  )
}

export function iconOptionForCategoryId(categoryId: string): CategoryIconOption {
  const fromKey = CATEGORY_ICON_OPTIONS.find((o) => o.key === categoryId)
  if (fromKey) return fromKey
  const hash = categoryId.split("").reduce((sum, c) => sum + c.charCodeAt(0), 0)
  return CATEGORY_ICON_OPTIONS[hash % CATEGORY_ICON_OPTIONS.length]
}
