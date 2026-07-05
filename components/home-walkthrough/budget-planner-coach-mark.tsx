"use client"

import type { RefObject } from "react"
import { CoachMarkOverlay } from "@/components/coach-mark/coach-mark-overlay"
import { useFinance } from "@/context/finance-context"
import { SETUP_TOUR_BUDGET_HINT } from "@/lib/setup-tour"

interface BudgetPlannerCoachMarkProps {
  introTargetRef: RefObject<HTMLElement | null>
  dismissed: boolean
  onDismiss: () => void
}

export function BudgetPlannerCoachMark({
  introTargetRef,
  dismissed,
  onDismiss,
}: BudgetPlannerCoachMarkProps) {
  const { isHomeSetupActive, homeSetupStep } = useFinance()

  if (!isHomeSetupActive || homeSetupStep !== 2 || dismissed) return null

  return (
    <CoachMarkOverlay
      targetRef={introTargetRef}
      text={SETUP_TOUR_BUDGET_HINT}
      onDismiss={onDismiss}
      nextLabel="Понятно"
      placement="below"
    />
  )
}
