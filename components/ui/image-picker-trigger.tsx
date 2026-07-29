"use client"

import { useRef, type ChangeEvent, type ReactNode } from "react"

type ImagePickerTriggerProps = {
  onPick: (file: File) => void
  children: ReactNode
  className?: string
  ariaLabel?: string
}

/** Opens the device gallery reliably inside Telegram Mini App WebViews. */
export function ImagePickerTrigger({
  onPick,
  children,
  className,
  ariaLabel = "Выбрать фото",
}: ImagePickerTriggerProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  function openPicker() {
    inputRef.current?.click()
  }

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ""
    if (file) onPick(file)
  }

  return (
    <>
      <button type="button" aria-label={ariaLabel} className={className} onClick={openPicker}>
        {children}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        tabIndex={-1}
        aria-hidden
        className="pointer-events-none fixed -left-[9999px] top-0 h-px w-px opacity-0"
        onChange={handleChange}
      />
    </>
  )
}

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === "string") resolve(reader.result)
      else reject(new Error("Не удалось прочитать файл"))
    }
    reader.onerror = () => reject(reader.error ?? new Error("Не удалось прочитать файл"))
    reader.readAsDataURL(file)
  })
}
