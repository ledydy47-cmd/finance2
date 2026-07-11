"use client"

import { useState } from "react"
import { BottomSheet } from "@/components/ui/bottom-sheet"
import { useFinance } from "@/context/finance-context"
import { formatRub, formatPercent } from "@/lib/format"

export function AddToGoalSheet() {
  const { data, addToGoalTargetId, closeAddToGoal, addToGoal } = useFinance()
  const [amount, setAmount] = useState("")

  const goal = data.goals.find((g) => g.id === addToGoalTargetId)
  const open = Boolean(goal)

  const parsedAmount = Number(amount.replace(/\s/g, "").replace(",", "."))
  const canSave = parsedAmount > 0 && goal !== undefined

  function handleClose() {
    closeAddToGoal()
    setAmount("")
  }

  function handleSave() {
    if (!canSave || !goal) return
    addToGoal(goal.id, parsedAmount)
    handleClose()
  }

  if (!goal) return null

  const remaining = Math.max(0, goal.targetAmount - goal.savedAmount)
  const percent = formatPercent(goal.savedAmount, goal.targetAmount)

  return (
    <BottomSheet
      open={open}
      title="Пополнить цель"
      onClose={handleClose}
      footer={
        <button
          type="button"
          disabled={!canSave}
          onClick={handleSave}
          className="w-full rounded-block-sm bg-primary py-4 text-sm font-bold text-primary-foreground shadow-sm shadow-primary/30 transition-transform active:scale-[0.98] disabled:opacity-40"
        >
          Отложить
        </button>
      }
    >
      <div className="mb-5 rounded-block bg-card p-4 shadow-sm shadow-primary/5">
        <p className="font-serif text-base font-bold text-foreground">{goal.name}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {formatRub(goal.savedAmount)} из {formatRub(goal.targetAmount)} · {percent}%
        </p>
        <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-secondary">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${percent}%` }}
          />
        </div>
        <p className="mt-2 text-xs font-medium text-[color:var(--success)]">
          Осталось {formatRub(remaining)}
        </p>
      </div>

      <label className="mb-1 text-xs font-semibold text-muted-foreground">Сумма</label>
      <input
        type="text"
        inputMode="decimal"
        placeholder="0"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        className="w-full min-w-0 max-w-full box-border rounded-block border border-border bg-card px-5 py-4 font-serif text-3xl font-bold text-foreground outline-none ring-primary focus:ring-2"
        autoFocus
      />
    </BottomSheet>
  )
}
