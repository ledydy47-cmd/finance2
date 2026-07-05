import Image from "next/image"
import type { LucideIcon } from "lucide-react"
import { getCategoryIcon } from "@/lib/icons"

/** Base sizes before 1.5× bump: image 40px, circle 44px */
export const categoryIconSizes = {
  md: { circle: 66, image: 60, lucide: 30 },
  sm: { circle: 60, image: 54, lucide: 27 },
  lg: { circle: 84, image: 72, lucide: 36 },
} as const

export type CategoryIconSize = keyof typeof categoryIconSizes

interface CategoryIconProps {
  icon: string
  iconImage?: string
  bar?: string
  pixelSize?: number
  lucideClassName?: string
}

export function CategoryIcon({
  icon,
  iconImage,
  bar,
  pixelSize = categoryIconSizes.md.image,
  lucideClassName,
}: CategoryIconProps) {
  if (iconImage) {
    return (
      <Image
        src={iconImage}
        alt=""
        width={pixelSize}
        height={pixelSize}
        className="object-contain"
        style={{ width: pixelSize, height: pixelSize }}
        aria-hidden
      />
    )
  }

  const Icon = getCategoryIcon(icon) as LucideIcon
  return (
    <Icon
      className={lucideClassName}
      style={{ color: bar, width: pixelSize, height: pixelSize }}
      strokeWidth={2.2}
    />
  )
}

interface CategoryIconBadgeProps {
  icon: string
  iconImage?: string
  bar: string
  tint: string
  size?: CategoryIconSize
}

export function CategoryIconBadge({
  icon,
  iconImage,
  bar,
  tint,
  size = "md",
}: CategoryIconBadgeProps) {
  const dims = categoryIconSizes[size]
  const iconPx = iconImage ? dims.image : dims.lucide

  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-full"
      style={{
        backgroundColor: tint,
        width: dims.circle,
        height: dims.circle,
      }}
      aria-hidden="true"
    >
      <CategoryIcon icon={icon} iconImage={iconImage} bar={bar} pixelSize={iconPx} />
    </span>
  )
}
