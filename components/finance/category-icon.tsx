/** Base sizes for emoji category badges — compact circle, larger emoji */
export const categoryIconSizes = {
  md: { circle: 48, emoji: 45 },
  sm: { circle: 42, emoji: 41 },
  lg: { circle: 56, emoji: 54 },
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
