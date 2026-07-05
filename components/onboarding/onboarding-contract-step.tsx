"use client"

import {
  Heart,
  Sparkles,
  Target,
  TrendingUp,
  Wallet,
  type LucideIcon,
} from "lucide-react"
import { COMMITMENT_ITEMS } from "@/lib/onboarding"

const ICONS: Record<(typeof COMMITMENT_ITEMS)[number]["icon"], LucideIcon> = {
  Wallet,
  Sparkles,
  Heart,
  Target,
  TrendingUp,
}

interface OnboardingContractStepProps {
  name: string
}

export function OnboardingContractStep({ name }: OnboardingContractStepProps) {
  const displayName = name.trim() || "собой"

  return (
    <div className="w-full">
      <h2 className="font-serif text-2xl font-bold text-foreground">
        Контракт с {displayName}
      </h2>
      <ul className="mt-5 flex flex-col gap-2.5">
        {COMMITMENT_ITEMS.map((item, index) => {
          const Icon = ICONS[item.icon]
          return (
            <li
              key={item.id}
              className="flex items-start gap-3 rounded-block-sm bg-card px-3.5 py-3.5 shadow-sm shadow-primary/5 animate-in fade-in slide-in-from-bottom-2 duration-300 fill-mode-both"
              style={{ animationDelay: `${index * 80}ms` }}
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/15">
                <Icon className="size-4 text-primary" strokeWidth={2.2} />
              </span>
              <p className="pt-1.5 text-sm font-medium leading-snug text-foreground">{item.text}</p>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
