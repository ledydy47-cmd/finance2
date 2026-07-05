"use client"

const SIZE_MAP = {
  sm: { box: "size-20", image: 64 },
  md: { box: "size-28", image: 88 },
  lg: { box: "size-36", image: 112 },
  xl: { box: "size-40", image: 128 },
  hero: { box: "size-44", image: 152 },
} as const

export function OnboardingMascot({ size = "hero" }: { size?: keyof typeof SIZE_MAP }) {
  const { box, image } = SIZE_MAP[size]

  return (
    <div
      className={`relative flex ${box} shrink-0 items-center justify-center overflow-hidden rounded-full bg-white p-1.5 shadow-lg shadow-primary/15 ring-1 ring-black/[0.04]`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/mascot.png"
        alt="Маниточка"
        width={image}
        height={image}
        className="h-[92%] w-[92%] object-contain object-center"
        style={{ backgroundColor: "transparent" }}
        decoding="async"
      />
    </div>
  )
}
