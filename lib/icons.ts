import {
  Bus,
  Carrot,
  Coffee,
  Heart,
  Home,
  Plane,
  ShoppingBag,
  Sparkles,
  Ticket,
  type LucideIcon,
} from "lucide-react"

const ICON_MAP: Record<string, LucideIcon> = {
  Carrot,
  Coffee,
  ShoppingBag,
  Bus,
  Sparkles,
  Heart,
  Home,
  Plane,
  Ticket,
}

export function getCategoryIcon(name: string): LucideIcon {
  return ICON_MAP[name] ?? Sparkles
}

export const CATEGORY_ICON_OPTIONS = Object.keys(ICON_MAP)
