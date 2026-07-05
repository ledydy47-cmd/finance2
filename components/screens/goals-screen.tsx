"use client"

import { useState } from "react"
import { Plus, Star, Trash2 } from "lucide-react"
import { useFinance } from "@/context/finance-context"
import { GoalCard } from "@/components/finance/goal-card"
import { getActiveGoals, getCompletedGoals } from "@/lib/goals"

export function GoalsScreen() {
  const {
    data,
    addGoal,
    updateGoal,
    deleteGoal,
    openAddToGoal,
    setPrimaryGoal,
    showGoalCreateForm,
    setShowGoalCreateForm,
  } = useFinance()
  const [name, setName] = useState("")
  const [target, setTarget] = useState("")
  const [image, setImage] = useState("/images/goal-sochi.png")

  const activeGoals = getActiveGoals(data.goals)
  const completedGoals = getCompletedGoals(data.goals)
  const showForm = showGoalCreateForm

  function handleCreate() {
    const targetAmount = Number(target.replace(/\s/g, ""))
    if (!name.trim() || targetAmount <= 0) return
    addGoal({ name: name.trim(), targetAmount, image })
    setName("")
    setTarget("")
    setImage("/images/goal-sochi.png")
    setShowGoalCreateForm(false)
  }

  function handleImageUpload(file: File | undefined) {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === "string") setImage(reader.result)
    }
    reader.readAsDataURL(file)
  }

  return (
    <>
      <header className="px-5 pb-2 pt-4">
        <h1 className="font-serif text-2xl font-bold text-foreground">Мои цели</h1>
        <p className="mt-1 text-sm text-muted-foreground">Выберите основную — она будет на главной</p>
      </header>

      <div className="flex-1 overflow-y-auto px-5 pb-28">
        {showForm && (
          <div className="mb-4 rounded-block bg-card p-4 shadow-sm shadow-primary/5">
            <p className="mb-3 font-serif text-base font-bold">Новая цель</p>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Название мечты"
              className="mb-2 w-full rounded-block-sm border border-border bg-background px-4 py-3 text-sm outline-none ring-primary focus:ring-2"
            />
            <input
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              placeholder="Целевая сумма"
              inputMode="numeric"
              className="mb-2 w-full rounded-block-sm border border-border bg-background px-4 py-3 text-sm outline-none ring-primary focus:ring-2"
            />
            <label className="mb-3 flex cursor-pointer items-center justify-center rounded-block-sm border border-dashed border-border py-6 text-xs font-semibold text-muted-foreground">
              Загрузить фото обложки
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handleImageUpload(e.target.files?.[0])}
              />
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleCreate}
                className="flex-1 rounded-block-sm bg-primary py-3 text-sm font-bold text-primary-foreground"
              >
                Создать
              </button>
              <button
                type="button"
                onClick={() => setShowGoalCreateForm(false)}
                className="rounded-block-sm bg-secondary px-4 py-3 text-sm font-semibold"
              >
                Отмена
              </button>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-4">
          {activeGoals.map((goal) => {
            const isPrimary = data.settings.primaryGoalId === goal.id
            return (
              <div key={goal.id} className="relative">
                <GoalCard
                  name={goal.name}
                  saved={goal.savedAmount}
                  target={goal.targetAmount}
                  image={goal.image}
                  isPrimary={isPrimary}
                  onAdd={() => openAddToGoal(goal.id)}
                  onImageChange={(file) => {
                    const reader = new FileReader()
                    reader.onload = () => {
                      if (typeof reader.result === "string") {
                        updateGoal(goal.id, { image: reader.result })
                      }
                    }
                    reader.readAsDataURL(file)
                  }}
                />
                <div className="absolute right-3 top-3 flex gap-2">
                  {!isPrimary && (
                    <button
                      type="button"
                      aria-label="Сделать основной целью"
                      onClick={() => setPrimaryGoal(goal.id)}
                      className="flex size-9 items-center justify-center rounded-full bg-card/90 text-primary shadow-sm"
                    >
                      <Star className="size-4" />
                    </button>
                  )}
                  <button
                    type="button"
                    aria-label="Удалить цель"
                    onClick={() => {
                      if (confirm(`Удалить цель «${goal.name}»?`)) deleteGoal(goal.id)
                    }}
                    className="flex size-9 items-center justify-center rounded-full bg-card/90 text-destructive shadow-sm"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>

        {completedGoals.length > 0 && (
          <section className="mt-8">
            <h2 className="mb-3 font-serif text-lg font-bold text-foreground">Выполненные цели</h2>
            <div className="flex flex-col gap-4">
              {completedGoals.map((goal) => (
                <GoalCard
                  key={goal.id}
                  name={goal.name}
                  saved={goal.savedAmount}
                  target={goal.targetAmount}
                  image={goal.image}
                  completed
                />
              ))}
            </div>
          </section>
        )}

        {!showForm && (
          <button
            type="button"
            onClick={() => setShowGoalCreateForm(true)}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-block border-2 border-dashed border-primary/30 py-4 text-sm font-bold text-primary"
          >
            <Plus className="size-4" />
            Добавить цель
          </button>
        )}
      </div>
    </>
  )
}
