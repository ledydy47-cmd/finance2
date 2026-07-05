"use client"

import Link from "next/link"

export function LegalLinks({ className = "" }: { className?: string }) {
  return (
    <div className={`flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-xs text-muted-foreground ${className}`}>
      <Link href="/terms" className="underline-offset-2 hover:text-primary hover:underline">
        Условия использования
      </Link>
      <span aria-hidden>·</span>
      <Link href="/privacy" className="underline-offset-2 hover:text-primary hover:underline">
        Политика конфиденциальности
      </Link>
    </div>
  )
}
