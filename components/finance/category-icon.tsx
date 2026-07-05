/** Base sizes for emoji category badges */
export const categoryIconSizes = {
  md: { circle: 66, emoji: 30 },
  sm: { circle: 60, emoji: 27 },
  lg: { circle: 84, emoji: 36 },
} as const

export type CategoryIconSize = keyof typeof categoryIconSizes

interface CategoryIconProps {
  icon: string
  pixelSize?: number
}

export function CategoryIcon({ icon, pixelSize = categoryIconSizes.md.emoji }: CategoryIconProps) {
  return (
    <span
      className="leading-none select-none"
      style={{ fontSize: pixelSize }}
      aria-hidden
    >
      {icon}
    </span>
  )
}

interface CategoryIconBadgeProps {
  icon: string
  bar: string
  tint: string
  size?: CategoryIconSize
}

export function CategoryIconBadge({
  icon,
  bar: _bar,
  tint,
  size = "md",
}: CategoryIconBadgeProps) {
  const dims = categoryIconSizes[size]

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
      <CategoryIcon icon={icon} pixelSize={dims.emoji} />
    </span>
  )
}
