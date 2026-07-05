"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useState } from "react"
import type { SupportTicket } from "@/lib/server/support-types"

const SESSION_KEY = "kopilka-admin-support-key"

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("ru-RU", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function userLabel(ticket: SupportTicket) {
  const parts = [
    ticket.userName,
    ticket.telegramUsername ? `@${ticket.telegramUsername}` : null,
    ticket.telegramUserId ? `id ${ticket.telegramUserId}` : ticket.userKey,
  ].filter(Boolean)
  return parts.join(" · ")
}

export default function AdminSupportPage() {
  const [adminKey, setAdminKey] = useState("")
  const [inputKey, setInputKey] = useState("")
  const [tickets, setTickets] = useState<SupportTicket[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [reply, setReply] = useState("")
  const [replying, setReplying] = useState(false)

  useEffect(() => {
    const fromUrl = new URLSearchParams(window.location.search).get("key")
    const stored = sessionStorage.getItem(SESSION_KEY)
    const key = fromUrl || stored || ""
    if (key) {
      setAdminKey(key)
      if (fromUrl) sessionStorage.setItem(SESSION_KEY, fromUrl)
    }
  }, [])

  const loadTickets = useCallback(async (key: string) => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch("/api/admin/support/tickets", {
        headers: { Authorization: `Bearer ${key}` },
      })
      const data = await response.json()
      if (!response.ok) {
        setError("Неверный ключ доступа")
        setTickets([])
        return
      }
      setTickets(data.tickets ?? [])
    } catch {
      setError("Не удалось загрузить обращения")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!adminKey) return
    void loadTickets(adminKey)
  }, [adminKey, loadTickets])

  const selected = useMemo(
    () => tickets.find((ticket) => ticket.id === selectedId) ?? null,
    [tickets, selectedId],
  )

  const openTickets = tickets.filter((ticket) => ticket.status === "open")
  const answeredTickets = tickets.filter((ticket) => ticket.status === "answered")

  function handleLogin(event: React.FormEvent) {
    event.preventDefault()
    const key = inputKey.trim()
    if (!key) return
    sessionStorage.setItem(SESSION_KEY, key)
    setAdminKey(key)
  }

  async function handleReply() {
    if (!selected || !adminKey) return
    const trimmed = reply.trim()
    if (!trimmed) return

    setReplying(true)
    setError(null)
    try {
      const response = await fetch(`/api/admin/support/tickets/${selected.id}/reply`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${adminKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ reply: trimmed }),
      })
      const data = await response.json()
      if (!response.ok) {
        setError("Не удалось отправить ответ")
        return
      }

      setReply("")
      setSelectedId(data.ticket.id)
      await loadTickets(adminKey)
    } catch {
      setError("Не удалось отправить ответ")
    } finally {
      setReplying(false)
    }
  }

  if (!adminKey) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-background px-6">
        <form onSubmit={handleLogin} className="w-full max-w-sm rounded-block bg-card p-6 shadow-sm">
          <h1 className="font-serif text-xl font-bold text-foreground">Поддержка · админ</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Введите секретный ключ из переменной ADMIN_SUPPORT_SECRET
          </p>
          <input
            type="password"
            value={inputKey}
            onChange={(e) => setInputKey(e.target.value)}
            className="mt-4 w-full rounded-block-sm border border-border bg-background px-4 py-3 text-sm outline-none ring-primary focus:ring-2"
            placeholder="Ключ доступа"
          />
          <button
            type="submit"
            className="mt-4 w-full rounded-block-sm bg-primary py-3 text-sm font-bold text-primary-foreground"
          >
            Войти
          </button>
        </form>
      </div>
    )
  }

  return (
    <div className="min-h-[100dvh] bg-background px-4 py-6 pb-12">
      <div className="mx-auto flex max-w-5xl flex-col gap-4 lg:flex-row">
        <div className="lg:w-[22rem] lg:shrink-0">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h1 className="font-serif text-2xl font-bold text-foreground">Поддержка</h1>
              <p className="text-sm text-muted-foreground">
                {openTickets.length} открытых · {answeredTickets.length} с ответом
              </p>
              <Link
                href={`/admin?key=${encodeURIComponent(adminKey)}&tab=stats`}
                className="mt-1 inline-block text-xs font-semibold text-primary underline-offset-2 hover:underline"
              >
                ← Админ-панель
              </Link>
            </div>
            <button
              type="button"
              onClick={() => void loadTickets(adminKey)}
              disabled={loading}
              className="rounded-block-sm border border-border px-3 py-2 text-xs font-semibold"
            >
              Обновить
            </button>
          </div>

          {error && <p className="mb-3 text-sm text-destructive">{error}</p>}

          <div className="space-y-2">
            {loading && tickets.length === 0 && (
              <p className="text-sm text-muted-foreground">Загрузка…</p>
            )}
            {tickets.map((ticket) => (
              <button
                key={ticket.id}
                type="button"
                onClick={() => {
                  setSelectedId(ticket.id)
                  setReply(ticket.reply ?? "")
                }}
                className={`w-full rounded-block-sm border px-3 py-3 text-left transition-colors ${
                  selectedId === ticket.id
                    ? "border-primary bg-primary/10"
                    : "border-border bg-card hover:bg-secondary/40"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-foreground">{userLabel(ticket)}</span>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                      ticket.status === "open"
                        ? "bg-primary/15 text-primary"
                        : "bg-secondary text-muted-foreground"
                    }`}
                  >
                    {ticket.status === "open" ? "новое" : "ответ"}
                  </span>
                </div>
                <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{ticket.message}</p>
                <p className="mt-1 text-[10px] text-muted-foreground/80">
                  {formatDateTime(ticket.createdAt)}
                </p>
              </button>
            ))}
            {!loading && tickets.length === 0 && (
              <p className="text-sm text-muted-foreground">Обращений пока нет</p>
            )}
          </div>
        </div>

        <div className="min-w-0 flex-1 rounded-block border border-border bg-card p-5 shadow-sm">
          {!selected ? (
            <p className="text-sm text-muted-foreground">Выберите обращение слева</p>
          ) : (
            <>
              <div className="mb-4 border-b border-border/70 pb-4">
                <p className="text-sm font-semibold text-foreground">{userLabel(selected)}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {formatDateTime(selected.createdAt)}
                </p>
              </div>

              <div className="mb-4 rounded-block-sm bg-secondary/50 p-4">
                <p className="mb-1 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  Вопрос
                </p>
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                  {selected.message}
                </p>
              </div>

              {selected.reply && (
                <div className="mb-4 rounded-block-sm border border-primary/20 bg-primary/5 p-4">
                  <p className="mb-1 text-xs font-bold uppercase tracking-wide text-primary">
                    Ваш ответ
                    {selected.repliedAt ? ` · ${formatDateTime(selected.repliedAt)}` : ""}
                  </p>
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                    {selected.reply}
                  </p>
                </div>
              )}

              <label className="mb-1 block text-xs font-semibold text-muted-foreground">
                {selected.status === "answered" ? "Изменить ответ" : "Ответ пользователю"}
              </label>
              <textarea
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                rows={5}
                placeholder="Напишите ответ — пользователь получит его в Telegram"
                className="mb-3 w-full resize-y rounded-block-sm border border-border bg-background px-4 py-3 text-sm outline-none ring-primary focus:ring-2"
              />
              <button
                type="button"
                onClick={handleReply}
                disabled={replying || !reply.trim()}
                className="rounded-block-sm bg-primary px-5 py-3 text-sm font-bold text-primary-foreground disabled:opacity-50"
              >
                {replying ? "Отправляем…" : "Отправить ответ в Telegram"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
