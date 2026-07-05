"use client"

import { useEffect } from "react"
import Image from "next/image"
import type { Goal } from "@/lib/types"
import { fireCelebrationConfetti } from "@/lib/confetti"

interface GoalCelebrationModalProps {
  goal: Goal
  onClose: () => void
}

export function GoalCelebrationModal({ goal, onClose }: GoalCelebrationModalProps) {
  useEffect(() => {
    void fireCelebrationConfetti()
  }, [])

  const isDataUrl = goal.image.startsWith("data:")
  const percent = Math.min(100, Math.round((goal.savedAmount / goal.targetAmount) * 100))

  return (
    <div className="absolute inset-0 z-[90] flex items-center justify-center bg-foreground/45 p-5 backdrop-blur-sm">
      <div className="w-full max-w-sm animate-in fade-in zoom-in-95 rounded-block bg-card p-6 shadow-xl shadow-primary/20 duration-500">
        <h2 className="text-center font-serif text-2xl font-bold text-foreground">
          Ты сделала это! 🎉
        </h2>
        <p className="mt-2 text-center text-sm leading-relaxed text-muted-foreground">
          Мечта «{goal.name}» накоплена 💗
        </p>

        <div className="relative mx-auto mt-5 h-40 w-full overflow-hidden rounded-block-inner">
          {isDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={goal.image} alt={goal.name} className="size-full object-cover" />
          ) : (
            <Image
              src={goal.image || "/placeholder.svg"}
              alt={goal.name}
              fill
              sizes="320px"
              className="object-cover"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-foreground/30 to-transparent" />
          <span className="absolute bottom-3 right-3 rounded-full bg-primary px-3 py-1 text-xs font-bold text-primary-foreground">
            {percent}%
          </span>
        </div>

        <div className="mt-4 h-3 overflow-hidden rounded-full bg-secondary">
          <div className="h-full w-full rounded-full bg-primary" />
        </div>

        <button
          type="button"
          onClick={onClose}
          className="mt-6 w-full rounded-block-sm bg-primary py-3.5 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/30 transition-transform active:scale-[0.98]"
        >
          Отлично!
        </button>
      </div>
    </div>
  )
}
