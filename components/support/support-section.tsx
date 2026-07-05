"use client"

import { MessageCircle } from "lucide-react"
import { useState } from "react"
import { supportMailtoUrl } from "@/lib/legal"

interface SupportSectionProps {
  compact?: boolean
}

export function SupportSection({ compact = false }: SupportSectionProps) {
  const [message, setMessage] = useState("")

  function handleOpenSupport() {
    window.location.href = supportMailtoUrl(message)
  }

  if (compact) {
    return (
      <button
        type="button"
        onClick={handleOpenSupport}
        className="flex w-full items-center justify-center gap-2 rounded-block-sm border border-primary/20 bg-primary/10 py-3 text-sm font-bold text-primary transition-transform active:scale-[0.98]"
      >
        <MessageCircle className="size-4" strokeWidth={2.2} />
        Поддержка
      </button>
    )
  }

  return (
    <section className="rounded-block bg-card p-4 shadow-sm shadow-primary/5">
      <h2 className="mb-1 font-serif text-base font-bold">Поддержка</h2>
      <p className="mb-3 text-sm text-muted-foreground">
        Напишите свой вопрос — откроется письмо на почту поддержки
      </p>
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Опишите вопрос или проблему…"
        rows={4}
        className="mb-3 w-full resize-none rounded-block-sm border border-border bg-background px-4 py-3 text-sm outline-none ring-primary focus:ring-2"
      />
      <button
        type="button"
        onClick={handleOpenSupport}
        className="flex w-full items-center justify-center gap-2 rounded-block-sm bg-primary py-3 text-sm font-bold text-primary-foreground shadow-sm shadow-primary/25 transition-transform active:scale-[0.98]"
      >
        <MessageCircle className="size-4" strokeWidth={2.2} />
        Написать в поддержку
      </button>
    </section>
  )
}
