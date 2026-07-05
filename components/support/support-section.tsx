"use client"

import { CheckCircle2, MessageCircle, X } from "lucide-react"
import { useState } from "react"
import { useTelegram } from "@/components/telegram/telegram-provider"
import { useFinance } from "@/context/finance-context"
import { useKeyboardScrollIntoView } from "@/hooks/use-keyboard-scroll"
import { getClientUserKey } from "@/lib/client-id"

function SentDialog({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-foreground/35 px-6 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="support-sent-title"
        className="w-full max-w-xs rounded-block bg-card p-6 text-center shadow-xl shadow-primary/15"
      >
        <CheckCircle2 className="mx-auto size-12 text-[color:var(--success)]" strokeWidth={2} />
        <p id="support-sent-title" className="mt-3 font-serif text-lg font-bold text-foreground">
          Отправлено
        </p>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Мы ответим в течение 24 часов и пришлём уведомление в Telegram
        </p>
        <button
          type="button"
          onClick={onClose}
          className="mt-5 w-full rounded-block-sm bg-primary py-3 text-sm font-bold text-primary-foreground"
        >
          Хорошо
        </button>
      </div>
    </div>
  )
}

interface SupportFormProps {
  onSent?: () => void
}

export function SupportForm({ onSent }: SupportFormProps) {
  const { user } = useTelegram()
  const { data } = useFinance()
  const scrollRef = useKeyboardScrollIntoView<HTMLDivElement>()
  const [message, setMessage] = useState("")
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  async function handleSubmit() {
    const trimmed = message.trim()
    if (trimmed.length < 3) {
      setError("Напишите вопрос чуть подробнее")
      return
    }

    setSending(true)
    setError(null)

    try {
      const response = await fetch("/api/support/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: trimmed,
          userKey: getClientUserKey(user?.id),
          telegramUserId: user?.id ?? null,
          telegramUsername: user?.username ?? null,
          userName: data.settings.userName || user?.first_name || null,
        }),
      })

      const payload = await response.json()
      if (!response.ok) {
        setError("Не удалось отправить. Попробуйте ещё раз.")
        return
      }

      setMessage("")
      setSent(true)
    } catch {
      setError("Не удалось отправить. Проверьте интернет и попробуйте снова.")
    } finally {
      setSending(false)
    }
  }

  return (
    <>
      <div ref={scrollRef} className="scroll-mt-24 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <p className="mb-3 text-sm text-muted-foreground">
          Напишите свой вопрос — мы ответим в течение 24 часов и пришлём уведомление
        </p>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Опишите вопрос или проблему…"
          rows={4}
          className="mb-3 w-full resize-none rounded-block-sm border border-border bg-background px-4 py-3 text-sm outline-none ring-primary focus:ring-2"
        />
        {error && (
          <p className="mb-3 text-xs text-destructive">{error}</p>
        )}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={sending}
          className="flex w-full items-center justify-center gap-2 rounded-block-sm bg-primary py-3 text-sm font-bold text-primary-foreground shadow-sm shadow-primary/25 transition-transform active:scale-[0.98] disabled:opacity-50"
        >
          <MessageCircle className="size-4" strokeWidth={2.2} />
          {sending ? "Отправляем…" : "Написать в поддержку"}
        </button>
      </div>

      {sent && <SentDialog onClose={() => setSent(false)} />}
    </>
  )
}

interface SupportSectionProps {
  compact?: boolean
}

export function SupportSection({ compact = false }: SupportSectionProps) {
  const [sheetOpen, setSheetOpen] = useState(false)

  if (compact) {
    return (
      <>
        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          className="flex w-full items-center justify-center gap-2 rounded-block-sm border border-primary/20 bg-primary/10 py-3 text-sm font-bold text-primary transition-transform active:scale-[0.98]"
        >
          <MessageCircle className="size-4" strokeWidth={2.2} />
          Поддержка
        </button>

        {sheetOpen && (
          <div className="fixed inset-0 z-[110] flex flex-col justify-end bg-foreground/30 backdrop-blur-sm">
            <button
              type="button"
              aria-label="Закрыть"
              className="min-h-0 flex-1"
              onClick={() => setSheetOpen(false)}
            />
            <div className="max-h-[85dvh] overflow-y-auto overscroll-contain rounded-t-[1.75rem] bg-background px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-4 shadow-2xl">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-serif text-lg font-bold text-foreground">Поддержка</h2>
                <button
                  type="button"
                  onClick={() => setSheetOpen(false)}
                  className="rounded-full p-1.5 text-muted-foreground hover:text-foreground"
                >
                  <X className="size-5" />
                </button>
              </div>
              <SupportForm onSent={() => setSheetOpen(false)} />
            </div>
          </div>
        )}
      </>
    )
  }

  return (
    <section className="rounded-block bg-card p-4 shadow-sm shadow-primary/5">
      <h2 className="mb-1 font-serif text-base font-bold">Поддержка</h2>
      <SupportForm />
    </section>
  )
}
