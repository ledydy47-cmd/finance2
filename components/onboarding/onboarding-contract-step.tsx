"use client"

import { COMMITMENT_ITEMS } from "@/lib/onboarding"
import { THEMES } from "@/lib/themes"

interface OnboardingContractStepProps {
  name: string
}

export function OnboardingContractStep({ name }: OnboardingContractStepProps) {
  const displayName = name.trim() || "собой"

  return (
    <div className="flex w-full flex-col items-center text-center">
      <h2 className="font-serif text-2xl font-bold text-foreground">
        Контракт с{" "}
        <span className="text-primary">{displayName}</span>
      </h2>

      <ul className="mt-5 flex w-full flex-col gap-2.5 text-left">
        {COMMITMENT_ITEMS.map((item, index) => {
          const accentSoft = THEMES[item.themeId].vars.secondary

          return (
            <li
              key={item.id}
              className="flex items-start gap-3 rounded-block-sm px-3.5 py-3.5 shadow-sm animate-in fade-in slide-in-from-bottom-2 duration-300 fill-mode-both"
              style={{
                backgroundColor: accentSoft,
                animationDelay: `${index * 80}ms`,
              }}
            >
              <span
                className="flex size-11 shrink-0 items-center justify-center rounded-full bg-white text-2xl shadow-sm"
                aria-hidden
              >
                {item.emoji}
              </span>
              <p className="pt-2 text-sm font-medium leading-snug text-foreground">{item.text}</p>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
