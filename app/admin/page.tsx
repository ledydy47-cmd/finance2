"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import type {
  AnalyticsEventType,
  MessageCampaign,
  UserAnalyticsRecord,
} from "@/lib/server/user-analytics-types"
import type { SupportTicket } from "@/lib/server/support-types"

const SESSION_KEY = "kopilka-admin-support-key"

const EVENT_LABELS: Record<AnalyticsEventType, string> = {
  app_opened: "Открыл приложение",
  onboarding_started: "Нажал «Начать»",
  onboarding_completed: "Завершил онбординг",
  walkthrough_completed: "Прошёл обучение",
  paywall_shown: "Увидел paywall",
  subscription_paid_monthly: "Оплатил месяц",
  subscription_paid_yearly: "Оплатил год",
  auto_renew_canceled: "Отключил автопродление",
}

type TabId = "stats" | "users" | "messages" | "support"
type UserFilter = "all" | "none" | "monthly" | "yearly"

function formatDateTime(iso: string | null) {
  if (!iso) return "—"
  return new Date(iso).toLocaleString("ru-RU", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function Check({ value }: { value: boolean }) {
  return (
    <span className={value ? "text-[color:var(--success)]" : "text-muted-foreground/40"}>
      {value ? "✓" : "—"}
    </span>
  )
}

function userLabel(user: UserAnalyticsRecord) {
  return [
    user.userName,
    user.telegramUsername ? `@${user.telegramUsername}` : null,
    user.telegramUserId ? `id ${user.telegramUserId}` : user.userKey,
  ]
    .filter(Boolean)
    .join(" · ")
}

export default function AdminDashboardPage() {
  const [adminKey, setAdminKey] = useState("")
  const [inputKey, setInputKey] = useState("")
  const [tab, setTab] = useState<TabId>("stats")
  const [summary, setSummary] = useState<Record<string, number> | null>(null)
  const [users, setUsers] = useState<UserAnalyticsRecord[]>([])
  const [userFilter, setUserFilter] = useState<UserFilter>("all")
  const [campaigns, setCampaigns] = useState<MessageCampaign[]>([])
  const [tickets, setTickets] = useState<SupportTicket[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [messageText, setMessageText] = useState("")
  const [messageFilter, setMessageFilter] = useState<MessageCampaign["filter"]>("all")
  const [scheduleName, setScheduleName] = useState("")
  const [scheduleAt, setScheduleAt] = useState("")
  const [scheduleFilter, setScheduleFilter] = useState<MessageCampaign["filter"]>("paywall_no_pay")
  const [selectedUserKey, setSelectedUserKey] = useState<string | null>(null)
  const [userMessage, setUserMessage] = useState("")
  const [userScheduleAt, setUserScheduleAt] = useState("")
  const [sendingToUser, setSendingToUser] = useState(false)
  const [delayHours, setDelayHours] = useState("3")
  const [scheduleType, setScheduleType] = useState<MessageCampaign["type"]>("delayed_filter")

  const selectedUser = users.find((user) => user.userKey === selectedUserKey) ?? null

  useEffect(() => {
    const fromUrl = new URLSearchParams(window.location.search).get("key")
    const stored = sessionStorage.getItem(SESSION_KEY)
    const key = fromUrl || stored || ""
    if (key) {
      setAdminKey(key)
      if (fromUrl) sessionStorage.setItem(SESSION_KEY, fromUrl)
    }
    const tabParam = new URLSearchParams(window.location.search).get("tab") as TabId | null
    if (tabParam) setTab(tabParam)
  }, [])

  const authHeaders = useCallback(
    () => ({ Authorization: `Bearer ${adminKey}` }),
    [adminKey],
  )

  const loadSummary = useCallback(async () => {
    const response = await fetch("/api/admin/analytics/summary", { headers: authHeaders() })
    const data = await response.json()
    if (response.ok) setSummary(data.summary)
  }, [authHeaders])

  const loadUsers = useCallback(async () => {
    const query = userFilter === "all" ? "" : `?filter=${userFilter}`
    const response = await fetch(`/api/admin/analytics/users${query}`, { headers: authHeaders() })
    const data = await response.json()
    if (response.ok) setUsers(data.users ?? [])
  }, [authHeaders, userFilter])

  const loadCampaigns = useCallback(async () => {
    const response = await fetch("/api/admin/messages", { headers: authHeaders() })
    const data = await response.json()
    if (response.ok) setCampaigns(data.campaigns ?? [])
  }, [authHeaders])

  const loadTickets = useCallback(async () => {
    const response = await fetch("/api/admin/support/tickets", { headers: authHeaders() })
    const data = await response.json()
    if (response.ok) setTickets(data.tickets ?? [])
  }, [authHeaders])

  const refresh = useCallback(async () => {
    if (!adminKey) return
    setLoading(true)
    setError(null)
    try {
      await Promise.all([loadSummary(), loadUsers(), loadCampaigns(), loadTickets()])
    } catch {
      setError("Не удалось загрузить данные")
    } finally {
      setLoading(false)
    }
  }, [adminKey, loadSummary, loadUsers, loadCampaigns, loadTickets])

  useEffect(() => {
    if (!adminKey) return
    void refresh()
  }, [adminKey, userFilter, refresh])

  function handleLogin(event: React.FormEvent) {
    event.preventDefault()
    const key = inputKey.trim()
    if (!key) return
    sessionStorage.setItem(SESSION_KEY, key)
    setAdminKey(key)
  }

  async function sendNow() {
    const response = await fetch("/api/admin/messages", {
      method: "POST",
      headers: { ...authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "send_now",
        filter: messageFilter,
        message: messageText,
      }),
    })
    const data = await response.json()
    if (!response.ok) {
      setError("Не удалось отправить сообщение")
      return
    }
    setMessageText("")
    alert(`Отправлено: ${data.sent ?? 0} из ${data.total ?? 0}`)
    await loadCampaigns()
  }

  async function createSchedule() {
    const response = await fetch("/api/admin/messages", {
      method: "POST",
      headers: { ...authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "schedule",
        name: scheduleName || "Рассылка",
        message: messageText,
        type: scheduleType,
        filter: scheduleType === "delayed_filter" ? scheduleFilter : messageFilter,
        scheduledAt: scheduleType === "scheduled_broadcast" ? scheduleAt : null,
        delayHours: scheduleType === "delayed_filter" ? Number(delayHours) : null,
      }),
    })
    if (!response.ok) {
      setError("Не удалось создать рассылку")
      return
    }
    setScheduleName("")
    setMessageText("")
    await loadCampaigns()
  }

  async function sendToSelectedUser() {
    if (!selectedUser || !userMessage.trim()) return
    setSendingToUser(true)
    setError(null)
    try {
      const response = await fetch("/api/admin/messages", {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "send_now",
          userKey: selectedUser.userKey,
          message: userMessage,
        }),
      })
      if (!response.ok) {
        setError("Не удалось отправить сообщение пользователю")
        return
      }
      setUserMessage("")
      alert("Сообщение отправлено")
    } catch {
      setError("Не удалось отправить сообщение пользователю")
    } finally {
      setSendingToUser(false)
    }
  }

  async function scheduleForSelectedUser() {
    if (!selectedUser || !userMessage.trim() || !userScheduleAt) return
    setSendingToUser(true)
    setError(null)
    try {
      const response = await fetch("/api/admin/messages", {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "schedule_user",
          userKey: selectedUser.userKey,
          message: userMessage,
          scheduledAt: new Date(userScheduleAt).toISOString(),
          name: `Сообщение · ${userLabel(selectedUser)}`,
        }),
      })
      if (!response.ok) {
        setError("Не удалось запланировать сообщение")
        return
      }
      setUserMessage("")
      setUserScheduleAt("")
      alert("Сообщение запланировано")
      await loadCampaigns()
    } catch {
      setError("Не удалось запланировать сообщение")
    } finally {
      setSendingToUser(false)
    }
  }

  if (!adminKey) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-background px-6">
        <form onSubmit={handleLogin} className="w-full max-w-sm rounded-block bg-card p-6 shadow-sm">
          <h1 className="font-serif text-xl font-bold">Админ-панель</h1>
          <p className="mt-2 text-sm text-muted-foreground">Введите ADMIN_SUPPORT_SECRET</p>
          <input
            type="password"
            value={inputKey}
            onChange={(e) => setInputKey(e.target.value)}
            className="mt-4 w-full rounded-block-sm border border-border bg-background px-4 py-3 text-sm outline-none ring-primary focus:ring-2"
          />
          <button type="submit" className="mt-4 w-full rounded-block-sm bg-primary py-3 text-sm font-bold text-primary-foreground">
            Войти
          </button>
        </form>
      </div>
    )
  }

  const statCards = summary
    ? [
        { label: "Открыли приложение", value: summary.totalAppOpened },
        { label: "Нажали «Начать»", value: summary.totalOnboardingStarted },
        { label: "Закончили онбординг", value: summary.totalOnboardingCompleted },
        { label: "Прошли обучение", value: summary.totalWalkthroughCompleted },
        { label: "Увидели paywall", value: summary.totalPaywallShown },
        { label: "Оплатили месяц", value: summary.totalSubscribedMonthly },
        { label: "Оплатили год", value: summary.totalSubscribedYearly },
        { label: "Отключили автопродление", value: summary.totalAutoRenewCanceled },
      ]
    : []

  return (
    <div className="min-h-[100dvh] bg-background px-4 py-6">
      <div className="mx-auto max-w-6xl">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-serif text-2xl font-bold">Админ-панель</h1>
            <p className="text-sm text-muted-foreground">Аналитика, пользователи, рассылки, поддержка</p>
          </div>
          <button
            type="button"
            onClick={() => void refresh()}
            disabled={loading}
            className="rounded-block-sm border border-border px-4 py-2 text-sm font-semibold"
          >
            {loading ? "Обновляем…" : "Обновить"}
          </button>
        </div>

        <div className="mb-5 flex flex-wrap gap-2">
          {(
            [
              ["stats", "Статистика"],
              ["users", "Пользователи"],
              ["messages", "Сообщения"],
              ["support", "Поддержка"],
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

        {tab === "stats" && (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {statCards.map((card) => (
              <div key={card.label} className="rounded-block border border-border bg-card p-4 shadow-sm">
                <p className="text-xs text-muted-foreground">{card.label}</p>
                <p className="mt-1 font-serif text-3xl font-bold">{card.value ?? 0}</p>
              </div>
            ))}
          </div>
        )}

        {tab === "users" && (
          <div className="grid gap-4 lg:grid-cols-[1fr_22rem]">
            <div>
              <div className="mb-3 flex flex-wrap gap-2">
                {(
                  [
                    ["all", "Все"],
                    ["none", "Без подписки"],
                    ["monthly", "Месяц"],
                    ["yearly", "Год"],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setUserFilter(id)}
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                      userFilter === id ? "bg-primary text-primary-foreground" : "bg-secondary"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="overflow-x-auto rounded-block border border-border bg-card">
                <table className="min-w-full text-left text-xs">
                  <thead className="border-b border-border bg-secondary/40 text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2">Пользователь</th>
                      <th className="px-3 py-2">Возраст</th>
                      <th className="px-3 py-2">Открыл</th>
                      <th className="px-3 py-2">Начал</th>
                      <th className="px-3 py-2">Онбординг</th>
                      <th className="px-3 py-2">Обучение</th>
                      <th className="px-3 py-2">Paywall</th>
                      <th className="px-3 py-2">Подписка</th>
                      <th className="px-3 py-2">Автооткл.</th>
                      <th className="px-3 py-2">Последний заход</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((user) => (
                      <tr
                        key={user.userKey}
                        onClick={() => setSelectedUserKey(user.userKey)}
                        className={`cursor-pointer border-b border-border/60 transition-colors hover:bg-secondary/30 ${
                          selectedUserKey === user.userKey ? "bg-primary/10" : ""
                        }`}
                      >
                        <td className="px-3 py-2 font-medium">{userLabel(user)}</td>
                        <td className="px-3 py-2">{user.age ?? "—"}</td>
                        <td className="px-3 py-2"><Check value={Boolean(user.appOpenedAt)} /></td>
                        <td className="px-3 py-2"><Check value={Boolean(user.onboardingStartedAt)} /></td>
                        <td className="px-3 py-2"><Check value={Boolean(user.onboardingCompletedAt)} /></td>
                        <td className="px-3 py-2"><Check value={Boolean(user.walkthroughCompletedAt)} /></td>
                        <td className="px-3 py-2"><Check value={Boolean(user.paywallShownAt)} /></td>
                        <td className="px-3 py-2">
                          {user.subscriptionPlan === "monthly"
                            ? "Месяц"
                            : user.subscriptionPlan === "yearly"
                              ? "Год"
                              : "—"}
                        </td>
                        <td className="px-3 py-2"><Check value={Boolean(user.autoRenewCanceledAt)} /></td>
                        <td className="px-3 py-2 whitespace-nowrap">{formatDateTime(user.lastVisitAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <aside className="rounded-block border border-border bg-card p-4 lg:sticky lg:top-4 lg:self-start">
              {!selectedUser ? (
                <p className="text-sm text-muted-foreground">Выберите пользователя для просмотра истории</p>
              ) : (
                <>
                  <h2 className="font-serif text-base font-bold">{userLabel(selectedUser)}</h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Последний заход: {formatDateTime(selectedUser.lastVisitAt)}
                  </p>

                  <div className="mt-4 space-y-2">
                    <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                      Действия
                    </p>
                    {[...selectedUser.events].reverse().map((event, index) => (
                      <div
                        key={`${event.type}-${event.at}-${index}`}
                        className="rounded-block-sm border border-border/70 px-3 py-2 text-xs"
                      >
                        <p className="font-semibold text-foreground">{EVENT_LABELS[event.type]}</p>
                        <p className="mt-0.5 text-muted-foreground">{formatDateTime(event.at)}</p>
                      </div>
                    ))}
                    {selectedUser.events.length === 0 && (
                      <p className="text-xs text-muted-foreground">Событий пока нет</p>
                    )}
                  </div>

                  <div className="mt-4 border-t border-border/70 pt-4">
                    <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                      Сообщение в бот
                    </p>
                    <textarea
                      value={userMessage}
                      onChange={(e) => setUserMessage(e.target.value)}
                      rows={3}
                      placeholder="Текст без имени — имя добавится автоматически"
                      className="w-full rounded-block-sm border border-border bg-background px-3 py-2 text-sm"
                    />
                    <input
                      type="datetime-local"
                      value={userScheduleAt}
                      onChange={(e) => setUserScheduleAt(e.target.value)}
                      className="mt-2 w-full rounded-block-sm border border-border bg-background px-3 py-2 text-sm"
                    />
                    <div className="mt-2 flex gap-2">
                      <button
                        type="button"
                        onClick={() => void sendToSelectedUser()}
                        disabled={sendingToUser || !userMessage.trim()}
                        className="flex-1 rounded-block-sm bg-primary py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-50"
                      >
                        {sendingToUser ? "…" : "Сейчас"}
                      </button>
                      <button
                        type="button"
                        onClick={() => void scheduleForSelectedUser()}
                        disabled={sendingToUser || !userMessage.trim() || !userScheduleAt}
                        className="flex-1 rounded-block-sm border border-primary/30 bg-primary/10 py-2.5 text-sm font-bold text-primary disabled:opacity-50"
                      >
                        Запланировать
                      </button>
                    </div>
                  </div>
                </>
              )}
            </aside>
          </div>
        )}

        {tab === "messages" && (
          <div className="grid gap-4 lg:grid-cols-2">
            <section className="rounded-block border border-border bg-card p-4">
              <h2 className="font-serif text-lg font-bold">Отправить сейчас</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                В начале сообщения автоматически подставится имя пользователя
              </p>
              <select
                value={messageFilter}
                onChange={(e) => setMessageFilter(e.target.value as MessageCampaign["filter"])}
                className="mt-3 w-full rounded-block-sm border border-border bg-background px-3 py-2 text-sm"
              >
                <option value="all">Все пользователи</option>
                <option value="no_subscription">Без подписки</option>
                <option value="monthly">Месячная подписка</option>
                <option value="yearly">Годовая подписка</option>
                <option value="paywall_no_pay">Paywall без оплаты</option>
              </select>
              <textarea
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                rows={4}
                placeholder="Текст сообщения без имени — имя добавится автоматически"
                className="mt-3 w-full rounded-block-sm border border-border bg-background px-3 py-2 text-sm"
              />
              <button
                type="button"
                onClick={() => void sendNow()}
                className="mt-3 rounded-block-sm bg-primary px-4 py-2 text-sm font-bold text-primary-foreground"
              >
                Отправить сейчас
              </button>
            </section>

            <section className="rounded-block border border-border bg-card p-4">
              <h2 className="font-serif text-lg font-bold">Запланировать</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Для отложенных сообщений используйте тот же текст, что выше, или введите отдельный ниже
              </p>
              <textarea
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                rows={3}
                placeholder="Текст сообщения"
                className="mt-3 w-full rounded-block-sm border border-border bg-background px-3 py-2 text-sm"
              />
              <input
                value={scheduleName}
                onChange={(e) => setScheduleName(e.target.value)}
                placeholder="Название кампании"
                className="mt-3 w-full rounded-block-sm border border-border bg-background px-3 py-2 text-sm"
              />
              <select
                value={scheduleType}
                onChange={(e) => setScheduleType(e.target.value as MessageCampaign["type"])}
                className="mt-3 w-full rounded-block-sm border border-border bg-background px-3 py-2 text-sm"
              >
                <option value="delayed_filter">Paywall без оплаты — через N часов</option>
                <option value="scheduled_broadcast">Разовая рассылка в дату и время</option>
              </select>
              <select
                value={scheduleType === "delayed_filter" ? scheduleFilter : messageFilter}
                onChange={(e) => {
                  const value = e.target.value as MessageCampaign["filter"]
                  if (scheduleType === "delayed_filter") setScheduleFilter(value)
                  else setMessageFilter(value)
                }}
                className="mt-3 w-full rounded-block-sm border border-border bg-background px-3 py-2 text-sm"
              >
                <option value="all">Все пользователи</option>
                <option value="no_subscription">Без подписки</option>
                <option value="monthly">Месячная подписка</option>
                <option value="yearly">Годовая подписка</option>
                <option value="paywall_no_pay">Paywall без оплаты</option>
              </select>
              {scheduleType === "delayed_filter" ? (
                <input
                  type="number"
                  min={1}
                  value={delayHours}
                  onChange={(e) => setDelayHours(e.target.value)}
                  placeholder="Часов задержки (например, 3)"
                  className="mt-3 w-full rounded-block-sm border border-border bg-background px-3 py-2 text-sm"
                />
              ) : (
                <input
                  type="datetime-local"
                  value={scheduleAt}
                  onChange={(e) => setScheduleAt(e.target.value)}
                  className="mt-3 w-full rounded-block-sm border border-border bg-background px-3 py-2 text-sm"
                />
              )}
              <button
                type="button"
                onClick={() => void createSchedule()}
                className="mt-3 rounded-block-sm border border-primary/30 bg-primary/10 px-4 py-2 text-sm font-bold text-primary"
              >
                Создать кампанию
              </button>
            </section>

            <section className="rounded-block border border-border bg-card p-4 lg:col-span-2">
              <h2 className="font-serif text-lg font-bold">Кампании</h2>
              <div className="mt-3 space-y-2">
                {campaigns.map((campaign) => (
                  <div key={campaign.id} className="rounded-block-sm border border-border px-3 py-2 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-semibold">{campaign.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {campaign.status} · отправлено {campaign.sentToUserKeys.length}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {campaign.type === "delayed_filter"
                        ? `Фильтр «${campaign.filter}» через ${campaign.delayHours} ч.`
                        : campaign.type === "scheduled_user"
                          ? `Пользователю ${campaign.targetUserKey ?? "—"} · ${formatDateTime(campaign.scheduledAt)}`
                          : `Рассылка ${formatDateTime(campaign.scheduledAt)} · ${campaign.filter}`}
                    </p>
                  </div>
                ))}
                {campaigns.length === 0 && (
                  <p className="text-sm text-muted-foreground">Кампаний пока нет</p>
                )}
              </div>
            </section>
          </div>
        )}

        {tab === "support" && (
          <div>
            <p className="mb-3 text-sm text-muted-foreground">
              Полный интерфейс ответов на обращения — на отдельной странице
            </p>
            <Link
              href={`/admin/support?key=${encodeURIComponent(adminKey)}`}
              className="inline-flex rounded-block-sm bg-primary px-4 py-2 text-sm font-bold text-primary-foreground"
            >
              Открыть поддержку
            </Link>
            <Link
              href={`/admin?key=${encodeURIComponent(adminKey)}&tab=stats`}
              className="ml-2 inline-flex rounded-block-sm border border-border px-4 py-2 text-sm font-semibold"
            >
              Главная админки
            </Link>
            <div className="mt-4 space-y-2">
              {tickets.slice(0, 10).map((ticket) => (
                <div key={ticket.id} className="rounded-block-sm border border-border bg-card px-3 py-2 text-sm">
                  <p className="font-semibold">{ticket.userName ?? ticket.userKey}</p>
                  <p className="line-clamp-2 text-xs text-muted-foreground">{ticket.message}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
