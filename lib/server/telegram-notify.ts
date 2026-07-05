const SUPPORT_EMAIL = "parshinadiana@yandex.ru"

export async function sendTelegramNotification(input: {
  telegramUserId: number | null
  text: string
}) {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token || !input.telegramUserId) {
    console.info("[telegram-notify]", input.text)
    return { ok: false as const, reason: "NO_BOT_OR_CHAT" as const }
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
  return new Date(iso).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  })
}

export { SUPPORT_EMAIL }
