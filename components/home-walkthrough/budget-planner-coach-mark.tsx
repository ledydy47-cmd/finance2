"use client"

import type { RefObject } from "react"
import { CoachMarkOverlay } from "@/components/coach-mark/coach-mark-overlay"
import { useFinance } from "@/context/finance-context"

interface BudgetPlannerCoachMarkProps {
  firstCategoryAmountRef: RefObject<HTMLInputElement | null>
  dismissed: boolean
  onDismiss: () => void
}

export function BudgetPlannerCoachMark({
  firstCategoryAmountRef,
  dismissed,
  onDismiss,
}: BudgetPlannerCoachMarkProps) {
  const { isHomeSetupActive, homeSetupStep } = useFinance()

  if (!isHomeSetupActive || homeSetupStep !== 2 || dismissed) return null

  return (
    <CoachMarkOverlay
      targetRef={firstCategoryAmountRef}
      text="Распланируй, сколько планируешь потратить в этой категории. Остаток пойдёт на мечту ✈️"
      onDismiss={onDismiss}
      nextLabel="Далее"
      placement="below"
    />
  )
}
