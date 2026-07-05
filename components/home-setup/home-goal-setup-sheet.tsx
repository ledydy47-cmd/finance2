"use client"

import { Camera, X } from "lucide-react"
import Image from "next/image"
import { useState } from "react"
import { useFinance } from "@/context/finance-context"
import { parseAmount } from "@/lib/budget-planner"
import { DEFAULT_GOAL_IMAGE } from "@/lib/setup-tour"

export function HomeGoalSetupSheet() {
  const { addGoal, setShowHomeGoalSetup } = useFinance()
  const [name, setName] = useState("")
  const [target, setTarget] = useState("")
  const [image, setImage] = useState(DEFAULT_GOAL_IMAGE)

  const targetAmount = parseAmount(target)
  const canSave = name.trim().length > 0 && targetAmount > 0
  const hasCustomPhoto = image.startsWith("data:")

  function handleImageUpload(file: File | undefined) {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === "string") setImage(reader.result)
    }
    reader.readAsDataURL(file)
  }

  function handleSave() {
    if (!canSave) return
    addGoal({ name: name.trim(), targetAmount, image })
    setShowHomeGoalSetup(false)
  }

  return (
    <div className="absolute inset-0 z-[70] flex flex-col justify-end bg-foreground/30 backdrop-blur-sm">
      <div className="animate-in slide-in-from-bottom duration-300 rounded-t-[2rem] bg-background px-5 pb-8 pt-4 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-serif text-lg font-bold text-foreground">Первая цель 💗</h2>
          <button
            type="button"
            onClick={() => setShowHomeGoalSetup(false)}
            aria-label="Закрыть"
            className="flex size-9 items-center justify-center rounded-full bg-secondary"
          >
            <X className="size-4" />
          </button>
        </div>

        <label className="relative mb-4 block h-36 overflow-hidden rounded-block-inner bg-secondary">
          {image.startsWith("data:") ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={image} alt="Фото цели" className="size-full object-cover" />
          ) : (
            <Image src={image} alt="Фото цели" fill className="object-cover" sizes="360px" />
          )}
          <span
            className={`absolute inset-0 flex flex-col items-center justify-center gap-2 ${
              hasCustomPhoto
                ? "bg-gradient-to-t from-black/55 via-black/20 to-transparent"
                : "bg-black/45"
            }`}
          >
            <span className="flex size-11 items-center justify-center rounded-full bg-white text-primary shadow-lg">
              <Camera className="size-5" strokeWidth={2.4} />
            </span>
            <span className="rounded-full bg-white px-4 py-1.5 text-sm font-bold text-foreground shadow-md">
              {hasCustomPhoto ? "Изменить фото" : "Добавить фото"}
            </span>
          </span>
          <input
            type="file"
            accept="image/*"
            className="absolute inset-0 cursor-pointer opacity-0"
            onChange={(e) => handleImageUpload(e.target.files?.[0])}
          />
        </label>

        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Например: Поездка в Сочи"
          className="mb-3 w-full rounded-block-sm border border-border bg-card px-4 py-3.5 text-sm font-semibold outline-none ring-primary focus:ring-2"
          autoFocus
        />
        <input
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          placeholder="Целевая сумма, ₽"
          inputMode="numeric"
          className="mb-4 w-full rounded-block-sm border border-border bg-card px-4 py-3.5 text-sm font-semibold outline-none ring-primary focus:ring-2"
        />

        <button
          type="button"
          disabled={!canSave}
          onClick={handleSave}
          className="w-full rounded-block-sm bg-primary py-4 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/30 transition-transform active:scale-[0.97] disabled:opacity-40"
        >
          Сохранить цель
        </button>
      </div>
    </div>
  )
}
