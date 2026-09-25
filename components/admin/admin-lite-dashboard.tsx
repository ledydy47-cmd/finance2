"use client"

import Link from "next/link"
import { useCallback, useEffect, useState } from "react"
import type { UserAnalyticsRecord } from "@/lib/server/user-analytics-types"
import type { SupportTicket } from "@/lib/server/support-types"

const SESSION_KEY = "kopilka-admin-support-key"

type TabId = "support" | "lookup" | "stats"

function formatDateTime(iso: string | null) {
  if (!iso) return "—"
  return new Date(iso).toLocaleString("ru-RU", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function ticketUserLabel(ticket: SupportTicket) {
  const name = ticket.userName?.trim() || "Пользователь"
  const username = ticket.telegramUsername ? `@${ticket.telegramUsername}` : null
  const id = ticket.telegramUserId ? `id ${ticket.telegramUserId}` : ticket.userKey
  return [name, username, id].filter(Boolean).join(" · ")
}

function todayYmdMoscow() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Moscow",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date())
}

export function AdminLiteDashboard() {
  const [adminKey, setAdminKey] = useState("")
  const [inputKey, setInputKey] = useState("")
  const [tab, setTab] = useState<TabId>("support")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [tickets, setTickets] = useState<SupportTicket[]>([])
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null)
  const [supportReply, setSupportReply] = useState("")
  const [replySending, setReplySending] = useState(false)

  const [lookupQuery, setLookupQuery] = useState("")
  const [lookupUser, setLookupUser] = useState<UserAnalyticsRecord | null>(null)
  const [lookupMessage, setLookupMessage] = useState("")
  const [lookupSending, setLookupSending] = useState(false)

  const [statsDate, setStatsDate] = useState(todayYmdMoscow())
  const [summary, setSummary] = useState<{
    allTime?: { totalUsers?: number; subscribedMonthly?: number; subscribedYearly?: number }
    daily?: { newUsers?: number; paywallShown?: number }
  } | null>(null)

  const selectedTicket = tickets.find((ticket) => ticket.id === selectedTicketId) ?? null

  useEffect(() => {
    const fromUrl = new URLSearchParams(window.location.search).get("key")
    const stored = sessionStorage.getItem(SESSION_KEY)
    const key = fromUrl || stored || ""
    if (key) {
      setAdminKey(key)
      if (fromUrl) sessionStorage.setItem(SESSION_KEY, fromUrl)
    }
    const tabParam = new URLSearchParams(window.location.search).get("tab") as TabId | null
    if (tabParam === "support" || tabParam === "lookup" || tabParam === "stats") {
      setTab(tabParam)
    }
  }, [])

  const authHeaders = useCallback(
    () => ({ Authorization: `Bearer ${adminKey}` }),
    [adminKey],
  )

  const loadTickets = useCallback(async () => {
    const response = await fetch("/api/admin/support/tickets?status=open&limit=100", {
      headers: authHeaders(),
    })
    const data = await response.json()
    if (!response.ok) throw new Error(data.error ?? "TICKETS_FAILED")
    setTickets(data.tickets ?? [])
  }, [authHeaders])

  const loadStats = useCallback(async () => {
    const response = await fetch(
      `/api/admin/analytics/summary?date=${encodeURIComponent(statsDate)}`,
      { headers: authHeaders() },
    )
    const data = await response.json()
    if (!response.ok) throw new Error(data.error ?? "SUMMARY_FAILED")
    setSummary(data.summary ?? null)
  }, [authHeaders, statsDate])

  const loadTab = useCallback(async () => {
    if (!adminKey) return
    setLoading(true)
    setError(null)
    try {
      if (tab === "support") await loadTickets()
      if (tab === "stats") await loadStats()
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "LOAD_FAILED")
    } finally {
      setLoading(false)
    }
  }, [adminKey, tab, loadTickets, loadStats])

  useEffect(() => {
    void loadTab()
  }, [loadTab])

  function handleLogin(event: React.FormEvent) {
    event.preventDefault()
    const key = inputKey.trim()
    if (!key) return
    sessionStorage.setItem(SESSION_KEY, key)
    setAdminKey(key)
  }

  async function sendReply() {
    if (!selectedTicket || !supportReply.trim()) return
    setReplySending(true)
    setError(null)
    try {
      const response = await fetch(`/api/admin/support/tickets/${selectedTicket.id}/reply`, {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ reply: supportReply.trim() }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error ?? "REPLY_FAILED")
      setSupportReply("")
      await loadTickets()
      setSelectedTicketId(null)
    } catch (replyError) {
      setError(replyError instanceof Error ? replyError.message : "REPLY_FAILED")
    } finally {
      setReplySending(false)
    }
  }

  async function runLookup(event: React.FormEvent) {
    event.preventDefault()
    const q = lookupQuery.trim()
    if (!q) return
    setLoading(true)
    setError(null)
    setLookupUser(null)
    try {
      const response = await fetch(`/api/admin/analytics/user?q=${encodeURIComponent(q)}`, {
        headers: authHeaders(),
      })
      const data = await response.json()
      if (response.status === 404) {
        setError("Пользователь не найден")
        return
      }
      if (!response.ok) throw new Error(data.error ?? "LOOKUP_FAILED")
      setLookupUser(data.user)
    } catch (lookupError) {
      setError(lookupError instanceof Error ? lookupError.message : "LOOKUP_FAILED")
    } finally {
      setLoading(false)
    }
  }

  async function sendToUser() {
    if (!lookupUser || !lookupMessage.trim()) return
    setLookupSending(true)
    setError(null)
    try {
      const response = await fetch("/api/admin/messages", {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "send_now",
          userKey: lookupUser.userKey,
          message: lookupMessage.trim(),
        }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error ?? "SEND_FAILED")
      setLookupMessage("")
      alert("Сообщение отправлено")
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "SEND_FAILED")
    } finally {
      setLookupSending(false)
    }
  }

  if (!adminKey) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4">
        <form onSubmit={handleLogin} className="w-full max-w-sm rounded-block border border-border bg-card p-6 shadow-sm">
          <h1 className="font-serif text-xl font-bold">Админка Lite</h1>
          <p className="mt-1 text-sm text-muted-foreground">Быстрая поддержка и поиск пользователя</p>
          <input
            type="password"
            value={inputKey}
            onChange={(e) => setInputKey(e.target.value)}
            placeholder="Ключ доступа"
            className="mt-4 w-full rounded-block-sm border border-border bg-background px-3 py-2 text-sm"
          />
          <button type="submit" className="mt-3 w-full rounded-block-sm bg-primary py-2.5 text-sm font-bold text-primary-foreground">
            Войти
          </button>
        </form>
      </div>
    )
  }

  return (
    <div className="min-h-[100dvh] bg-background px-4 py-6">
      <div className="mx-auto max-w-4xl">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-serif text-2xl font-bold">Админка Lite</h1>
            <p className="text-sm text-muted-foreground">
              Только открытые тикеты, поиск и краткая статистика ·{" "}
              <Link href="/admin/support" className="font-semibold text-primary underline-offset-2 hover:underline">
                полная версия
              </Link>
            </p>
          </div>
          <button
            type="button"
            onClick={() => void loadTab()}
            disabled={loading}
            className="rounded-block-sm border border-border px-4 py-2 text-sm font-semibold"
          >
            {loading ? "…" : "Обновить"}
          </button>
        </div>

        <div className="mb-5 flex flex-wrap gap-2">
          {(
            [
              ["support", "Поддержка"],
              ["lookup", "Найти пользователя"],
              ["stats", "Сводка"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`rounded-full px-4 py-2 text-sm font-semibold ${
                tab === id ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {error && <p className="mb-4 text-sm text-destructive">{error}</p>}

        {tab === "support" && (
          <div className="flex flex-col gap-4 lg:flex-row">
            <div className="lg:w-[20rem] lg:shrink-0">
              <p className="mb-2 text-sm text-muted-foreground">{tickets.length} открытых (макс. 100)</p>
              <div className="space-y-2">
                {tickets.map((ticket) => (
                  <button
                    key={ticket.id}
                    type="button"
                    onClick={() => {
                      setSelectedTicketId(ticket.id)
                      setSupportReply(ticket.reply ?? "")
                    }}
                    className={`w-full rounded-block-sm border px-3 py-3 text-left ${
                      selectedTicketId === ticket.id
                        ? "border-primary bg-primary/10"
                        : "border-border bg-card"
                    }`}
                  >
                    <p className="text-xs font-semibold">{ticketUserLabel(ticket)}</p>
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{ticket.message}</p>
                    <p className="mt-1 text-[10px] text-muted-foreground">{formatDateTime(ticket.createdAt)}</p>
                  </button>
                ))}
                {!loading && tickets.length === 0 && (
                  <p className="text-sm text-muted-foreground">Открытых обращений нет</p>
                )}
              </div>
            </div>

            <div className="min-w-0 flex-1 rounded-block border border-border bg-card p-5">
              {!selectedTicket ? (
                <p className="text-sm text-muted-foreground">Выберите обращение</p>
              ) : (
                <>
                  <p className="text-sm font-semibold">{ticketUserLabel(selectedTicket)}</p>
                  <p className="mt-3 whitespace-pre-wrap text-sm">{selectedTicket.message}</p>
                  <textarea
                    value={supportReply}
                    onChange={(e) => setSupportReply(e.target.value)}
                    rows={8}
                    className="mt-4 w-full rounded-block-sm border border-border bg-background px-3 py-2 text-sm"
                    placeholder="Ответ пользователю…"
                  />
                  <button
                    type="button"
                    onClick={() => void sendReply()}
                    disabled={replySending || !supportReply.trim()}
                    className="mt-3 rounded-block-sm bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-50"
                  >
                    {replySending ? "Отправляем…" : "Ответить и уведомить"}
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {tab === "lookup" && (
          <div className="rounded-block border border-border bg-card p-5">
            <form onSubmit={(e) => void runLookup(e)} className="flex flex-wrap gap-2">
              <input
                value={lookupQuery}
                onChange={(e) => setLookupQuery(e.target.value)}
                placeholder="Telegram id, @username или tg-…"
                className="min-w-[14rem] flex-1 rounded-block-sm border border-border bg-background px-3 py-2 text-sm"
              />
              <button
                type="submit"
                disabled={loading}
                className="rounded-block-sm bg-primary px-4 py-2 text-sm font-bold text-primary-foreground"
              >
                Найти
              </button>
            </form>

            {lookupUser && (
              <div className="mt-5 space-y-3 border-t border-border pt-4 text-sm">
                <p>
                  <span className="font-semibold">{lookupUser.userName ?? "—"}</span>
                  {lookupUser.telegramUsername ? ` · @${lookupUser.telegramUsername}` : ""}
                  {lookupUser.telegramUserId ? ` · id ${lookupUser.telegramUserId}` : ""}
                </p>
                <p className="text-muted-foreground">
                  План: {lookupUser.subscriptionPlan} · последний визит:{" "}
                  {formatDateTime(lookupUser.lastVisitAt)}
                </p>
                <textarea
                  value={lookupMessage}
                  onChange={(e) => setLookupMessage(e.target.value)}
                  rows={4}
                  className="w-full rounded-block-sm border border-border bg-background px-3 py-2 text-sm"
                  placeholder="Сообщение в Telegram…"
                />
                <button
                  type="button"
                  onClick={() => void sendToUser()}
                  disabled={lookupSending || !lookupMessage.trim()}
                  className="rounded-block-sm border border-primary bg-primary/10 px-4 py-2 text-sm font-bold text-primary disabled:opacity-50"
                >
                  {lookupSending ? "…" : "Отправить сообщение"}
                </button>
              </div>
            )}
          </div>
        )}

        {tab === "stats" && (
          <div className="rounded-block border border-border bg-card p-5">
            <label className="mb-2 block text-xs font-semibold text-muted-foreground">День (МСК)</label>
            <input
              type="date"
              value={statsDate}
              onChange={(e) => setStatsDate(e.target.value)}
              className="mb-4 rounded-block-sm border border-border bg-background px-3 py-2 text-sm"
            />
            {summary && (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <StatCard label="Всего пользователей" value={summary.allTime?.totalUsers ?? 0} />
                <StatCard label="Месячных" value={summary.allTime?.subscribedMonthly ?? 0} />
                <StatCard label="Годовых" value={summary.allTime?.subscribedYearly ?? 0} />
                <StatCard label="Новых за день" value={summary.daily?.newUsers ?? 0} />
                <StatCard label="Paywall за день" value={summary.daily?.paywallShown ?? 0} />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-block-sm bg-secondary/60 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-serif text-2xl font-bold">{value}</p>
    </div>
  )
}
