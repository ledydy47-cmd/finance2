"use client"

import { useEffect, useState } from "react"
import { BottomSheet } from "@/components/ui/bottom-sheet"
import { CategoryIconBadge } from "@/components/finance/category-icon"
import { useFinance } from "@/context/finance-context"
import type { TransactionType } from "@/lib/types"

export function AddTransactionSheet() {
  const {
    data,
    showAddTransaction,
    setShowAddTransaction,
    addTransaction,
    addTransactionDraft,
  } = useFinance()
  const [amount, setAmount] = useState("")
  const [type, setType] = useState<TransactionType>("expense")
  const [categoryId, setCategoryId] = useState<string | null>(data.categories[0]?.id ?? null)
  const [note, setNote] = useState("")

  const parsedAmount = Number(amount.replace(/\s/g, "").replace(",", "."))
  const canSave = parsedAmount > 0 && (type === "income" || categoryId)

  useEffect(() => {
    if (!showAddTransaction) return
    if (addTransactionDraft) {
      setType(addTransactionDraft.type)
      setCategoryId(addTransactionDraft.categoryId)
    } else {
      setType("expense")
      setCategoryId(data.categories[0]?.id ?? null)
    }
    setAmount("")
    setNote("")
  }, [showAddTransaction, addTransactionDraft, data.categories])

  function handleClose() {
    setShowAddTransaction(false)
  }

  function handleSave() {
    if (!canSave) return
    addTransaction({
      amount: parsedAmount,
      type,
      categoryId: type === "expense" ? categoryId : null,
      note,
    })
    handleClose()
  }

  const title = addTransactionDraft ? "Расход в категорию" : "Новая операция"

  return (
    <BottomSheet
      open={showAddTransaction}
      title={title}
      onClose={handleClose}
      footer={
        <button
          type="button"
          disabled={!canSave}
          onClick={handleSave}
          className="w-full rounded-block-sm bg-primary py-4 text-sm font-bold text-primary-foreground shadow-sm shadow-primary/30 transition-transform active:scale-[0.98] disabled:opacity-40"
        >
          Сохранить
        </button>
      }
    >
      <div className="w-full min-w-0 max-w-full">
      {!addTransactionDraft && (
        <div className="mb-5 flex w-full min-w-0 rounded-block-sm bg-secondary p-1">
          {(["expense", "income"] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setType(value)}
              className={`flex-1 rounded-block-inner py-2.5 text-sm font-bold transition-colors ${
                type === value ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
              }`}
            >
              {value === "expense" ? "Расход" : "Доход"}
            </button>
          ))}
        </div>
      )}

      <label className="mb-1 text-xs font-semibold text-muted-foreground">Сумма</label>
      <input
        type="text"
        inputMode="decimal"
        placeholder="0"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        className="mb-5 w-full min-w-0 max-w-full box-border rounded-block border border-border bg-card px-5 py-4 font-serif text-3xl font-bold text-foreground outline-none ring-primary focus:ring-2"
        autoFocus
      />

      {type === "expense" && (
        <>
          <p className="mb-2 text-xs font-semibold text-muted-foreground">Категория</p>
          <div className="mb-5 grid w-full min-w-0 grid-cols-3 gap-2">
            {data.categories.map((category) => {
              const selected = categoryId === category.id
              return (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => setCategoryId(category.id)}
                  className={`flex flex-col items-center gap-1.5 rounded-block-sm p-3 transition-all ${
                    selected ? "bg-primary/15 ring-2 ring-primary" : "bg-card"
                  }`}
                >
                  <CategoryIconBadge
                    icon={category.icon}
                    bar={category.bar}
                    tint={category.tint}
                    size="lg"
                  />
                  <span className="line-clamp-2 text-center text-[10px] font-semibold leading-tight">
                    {category.name}
                  </span>
                </button>
              )
            })}
          </div>
        </>
      )}

      <label className="mb-1 text-xs font-semibold text-muted-foreground">
        Заметка (необязательно)
      </label>
      <input
        type="text"
        placeholder="Кофейня, зарплата…"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        className="w-full min-w-0 max-w-full box-border rounded-block-sm border border-border bg-card px-4 py-3 text-sm outline-none ring-primary focus:ring-2"
      />
      </div>
    </BottomSheet>
  )
}
