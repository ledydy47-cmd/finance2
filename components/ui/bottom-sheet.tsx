"use client"

import { X } from "lucide-react"
import type { ReactNode } from "react"

interface BottomSheetProps {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
}

export function BottomSheet({ open, title, onClose, children }: BottomSheetProps) {
  if (!open) return null

  return (
    <div className="absolute inset-0 z-50 flex flex-col justify-end bg-foreground/25 backdrop-blur-sm">
      <div className="flex max-h-[92%] flex-col rounded-t-block bg-background px-5 pb-8 pt-4 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-serif text-xl font-bold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть"
            className="flex size-10 items-center justify-center rounded-block-sm bg-card"
          >
            <X className="size-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
