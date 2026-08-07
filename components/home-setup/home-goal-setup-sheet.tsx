"use client"

import { Camera, X } from "lucide-react"
import Image from "next/image"
import { useState } from "react"
import { ImagePickerTrigger, readFileAsDataUrl } from "@/components/ui/image-picker-trigger"
import { useFinance } from "@/context/finance-context"
import { parseAmount } from "@/lib/budget-planner"
import { DEFAULT_GOAL_IMAGE } from "@/lib/setup-tour"

export function HomeGoalSetupSheet() {
  const { addGoal, setShowHomeGoalSetup, persistError, clearPersistError } = useFinance()
  const [name, setName] = useState("")
  const [target, setTarget] = useState("")
  const [image, setImage] = useState(DEFAULT_GOAL_IMAGE)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [photoError, setPhotoError] = useState<string | null>(null)
  const [photoLoading, setPhotoLoading] = useState(false)

  const targetAmount = parseAmount(target)
  const canSave = name.trim().length > 0 && targetAmount > 0 && !photoLoading
  const hasCustomPhoto = image.startsWith("data:")
  const visibleError = saveError ?? persistError

  function handleImageUpload(file: File) {
    setPhotoError(null)
    setSaveError(null)
    clearPersistError()
    setPhotoLoading(true)
    void readFileAsDataUrl(file)
      .then((dataUrl) => setImage(dataUrl))
      .catch(() => {
        setPhotoError("Не удалось загрузить фото. Попробуйте другое или сохраните цель без фото.")
      })
      .finally(() => setPhotoLoading(false))
  }

  function handleSave() {
    if (!canSave) return
    setSaveError(null)
    clearPersistError()

    const saved = addGoal({ name: name.trim(), targetAmount, image })
    if (!saved) {
      setSaveError(
        "Не удалось сохранить цель. Попробуйте без своего фото или перезапустите приложение.",
      )
      return
    }

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

        <div className="relative mb-4 h-36 overflow-hidden rounded-block-inner bg-secondary">
          {image.startsWith("data:") ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={image} alt="Фото цели" className="size-full object-cover" />
          ) : (
            <Image src={image} alt="Фото цели" fill className="object-cover" sizes="360px" />
          )}
          <ImagePickerTrigger
            ariaLabel={hasCustomPhoto ? "Изменить фото" : "Добавить фото"}
            className={`absolute inset-0 flex flex-col items-center justify-center gap-2 ${
              hasCustomPhoto
                ? "bg-gradient-to-t from-black/55 via-black/20 to-transparent"
                : "bg-black/45"
            }`}
            onPick={handleImageUpload}
          >
            <span className="pointer-events-none flex size-11 items-center justify-center rounded-full bg-white text-primary shadow-lg">
              <Camera className="size-5" strokeWidth={2.4} />
            </span>
            <span className="pointer-events-none rounded-full bg-white px-4 py-1.5 text-sm font-bold text-foreground shadow-md">
              {photoLoading ? "Загрузка…" : hasCustomPhoto ? "Изменить фото" : "Добавить фото"}
            </span>
          </ImagePickerTrigger>
        </div>

        {photoError && (
          <p className="mb-3 rounded-block-sm bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive">
            {photoError}
          </p>
        )}

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

        {visibleError && (
          <p className="mb-3 rounded-block-sm bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive">
            {visibleError}
          </p>
        )}

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
