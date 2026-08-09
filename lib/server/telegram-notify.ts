const SUPPORT_EMAIL = "parshinadiana@yandex.ru"

export async function sendTelegramNotification(input: {
  telegramUserId: number | null
  text: string
  /** When true, still deliver even if the user opted out of bot notifications. */
  allowWhenMuted?: boolean
}) {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token || !input.telegramUserId) {
    console.info("[telegram-notify]", input.text)
    return { ok: false as const, reason: "NO_BOT_OR_CHAT" as const }
  }

  if (!input.allowWhenMuted) {
    const { isTelegramNotificationsMuted } = await import(
      "@/lib/server/notifications-muted-service"
    )
    if (await isTelegramNotificationsMuted(input.telegramUserId)) {
      return { ok: false as const, reason: "NOTIFICATIONS_MUTED" as const }
    }
  }

  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: input.telegramUserId,
      text: input.text,
    }),
  })

  if (!response.ok) {
    const details = await response.text()
    console.error("[telegram-notify] failed", details)
    return { ok: false as const, reason: "SEND_FAILED" as const }
  }

  return { ok: true as const }
}

export function formatPeriodEnd(iso: string) {
  try {
    const date = new Date(iso)
    if (Number.isNaN(date.getTime())) return iso
    return date.toLocaleDateString("ru-RU", {
      day: "numeric",
      month: "long",
      year: "numeric",
    })
  } catch {
    return iso
  }
}

export { SUPPORT_EMAIL }
