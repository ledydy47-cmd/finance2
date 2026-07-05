"use client"

import { Plus } from "lucide-react"
import Image from "next/image"

interface GhostGoalCardProps {
  onClick: () => void
  highlighted?: boolean
}

export function GhostGoalCard({ onClick, highlighted }: GhostGoalCardProps) {
  return (
    <button
      type="button"
      data-tour="ghost-goal"
      onClick={onClick}
      className={`w-full overflow-hidden rounded-block bg-card text-left shadow-sm shadow-primary/5 transition-all ${
        highlighted ? "relative z-[65] opacity-40 ring-2 ring-primary/30" : "pointer-events-none opacity-40"
      }`}
    >
      <div className="relative m-3 h-36 overflow-hidden rounded-block-inner bg-secondary">
        <Image
          src="/images/goal-sochi.png"
          alt=""
          fill
          className="object-cover grayscale"
          sizes="360px"
        />
        <div className="absolute inset-0 bg-background/30" />
      </div>
      <div className="px-5 pb-5">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="font-serif text-lg font-bold text-card-foreground">Моя мечта ✈️</h3>
          <span className="shrink-0 rounded-full bg-accent px-2.5 py-1 text-xs font-bold text-accent-foreground">
            0%
          </span>
        </div>
        <p className="mt-1 text-sm font-medium text-muted-foreground">0 ₽ из 80 000 ₽</p>
        <div className="mt-3 h-3 w-full overflow-hidden rounded-full bg-secondary">
          <div className="h-full w-[8%] rounded-full bg-primary/40" />
        </div>
        <span className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-block-sm bg-primary/20 py-3 text-sm font-bold text-primary">
          <Plus className="size-4" strokeWidth={2.8} />
          Добавить цель
        </span>
      </div>
    </button>
  )
}
