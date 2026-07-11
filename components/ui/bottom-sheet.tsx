"use client"

import { X } from "lucide-react"
import type { ReactNode } from "react"

interface BottomSheetProps {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
}

export function BottomSheet({ open, title, onClose, children, footer }: BottomSheetProps) {
  if (!open) return null

  return (
    <div className="absolute inset-0 z-50 flex flex-col justify-end bg-foreground/25 backdrop-blur-sm">
      <div className="flex max-h-[92dvh] min-h-0 flex-col rounded-t-block bg-background shadow-2xl">
        <div className="flex shrink-0 items-center justify-between px-5 pb-4 pt-4">
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
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-4">{children}</div>
        {footer ? (
          <div className="shrink-0 border-t border-border/60 bg-background px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-4">
            {footer}
          </div>
        ) : (
          <div className="shrink-0 pb-[max(1.5rem,env(safe-area-inset-bottom))]" />
        )}
      </div>
    </div>
  )
}
