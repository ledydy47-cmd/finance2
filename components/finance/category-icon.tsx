/** Emoji sizes for category icons (no background circle) */
export const categoryIconSizes = {
  md: { emoji: 32 },
  sm: { emoji: 29 },
  lg: { emoji: 38 },
} as const

export type CategoryIconSize = keyof typeof categoryIconSizes

interface CategoryIconProps {
  icon: string
  pixelSize?: number
}

export function CategoryIcon({ icon, pixelSize = categoryIconSizes.md.emoji }: CategoryIconProps) {
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center leading-none select-none"
      style={{ fontSize: pixelSize, width: pixelSize, height: pixelSize }}
      aria-hidden
    >
      {icon}
    </span>
  )
}

interface CategoryIconBadgeProps {
  icon: string
  bar?: string
  tint?: string
  size?: CategoryIconSize
}

export function CategoryIconBadge({ icon, size = "md" }: CategoryIconBadgeProps) {
  const dims = categoryIconSizes[size]
  return <CategoryIcon icon={icon} pixelSize={dims.emoji} />
}
