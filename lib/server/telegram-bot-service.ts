import { createSupportTicket } from "@/lib/server/support-service"
import { sendTelegramNotification } from "@/lib/server/telegram-notify"
import { ensureAnalyticsUser } from "@/lib/server/user-analytics-service"
import { registerTelegramUser } from "@/lib/server/telegram-users"

const START_REPLY =
  "Привет! Открой «Мани.точка» через кнопку меню в этом чате.\n\nЕсли хотите поделиться отзывом или идеей — просто напишите сообщение сюда, мы всё прочитаем 💗"

const FEEDBACK_ACK_REPLY =
  "Спасибо! Мы получили ваш отзыв и обязательно его прочитаем 💗"

interface TelegramUser {
  id: number
  username?: string
  first_name?: string
}

interface TelegramMessage {
  message_id: number
  text?: string
  caption?: string
  from?: TelegramUser
  chat?: { id: number; type?: string }
}

function getWebhookSecret() {
  return process.env.TELEGRAM_WEBHOOK_SECRET?.trim() || process.env.CRON_SECRET?.trim() || ""
}

export interface TelegramUpdate {
  update_id: number
  message?: TelegramMessage
}

function getMessageText(message: TelegramMessage) {
  return message.text?.trim() || message.caption?.trim() || ""
}

function isPrivateChat(message: TelegramMessage) {
  return message.chat?.type === "private"
}

export async function handleTelegramUpdate(update: TelegramUpdate) {
  const message = update.message
  if (!message?.from || !isPrivateChat(message)) {
    return { handled: false as const, reason: "IGNORED_UPDATE" as const }
  }

  const telegramUserId = message.from.id
  const text = getMessageText(message)

  if (!text) {
    await sendTelegramNotification({
      telegramUserId,
      text: "Напишите, пожалуйста, текстом — так мы точно увидим ваш отзыв 💗",
    })
    return { handled: true as const, action: "NON_TEXT_PROMPT" as const }
  }

  if (text.startsWith("/start")) {
    await sendTelegramNotification({
      telegramUserId,
      text: START_REPLY,
    })
    return { handled: true as const, action: "START_REPLY" as const }
  }

  if (text.startsWith("/")) {
    return { handled: false as const, reason: "UNKNOWN_COMMAND" as const }
  }

  const userKey = `tg-${telegramUserId}`
  const username = message.from.username ?? null
  const firstName = message.from.first_name?.trim() || null

  await registerTelegramUser({
    telegramUserId,
    username,
    firstName,
  })
  await ensureAnalyticsUser({
    userKey,
    telegramUserId,
    telegramUsername: username,
    userName: firstName,
  })

  const ticketResult = await createSupportTicket({
    userKey,
    telegramUserId,
    telegramUsername: username,
    userName: firstName,
    message: text,
    source: "bot",
  })

  if (!ticketResult.ok) {
    await sendTelegramNotification({
      telegramUserId,
      text: "Сообщение слишком короткое. Напишите чуть подробнее, пожалуйста 💗",
    })
    return { handled: true as const, action: "MESSAGE_TOO_SHORT" as const }
  }

  await sendTelegramNotification({
    telegramUserId,
    text: FEEDBACK_ACK_REPLY,
  })

  return {
    handled: true as const,
    action: "FEEDBACK_TICKET" as const,
    ticketId: ticketResult.ticketId,
  }
}

export async function setTelegramWebhook(input?: { dropPendingUpdates?: boolean }) {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim()
  if (!token) {
    return { ok: false as const, error: "NO_BOT_TOKEN" as const }
  }

  const { getAppBaseUrl } = await import("@/lib/yookassa/server")
  const secret = getWebhookSecret()
  const url = new URL(`${getAppBaseUrl()}/api/telegram/webhook`)
  if (secret) {
    url.searchParams.set("secret", secret)
  }

  const response = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url: url.toString(),
      allowed_updates: ["message"],
      drop_pending_updates: input?.dropPendingUpdates ?? false,
      ...(secret ? { secret_token: secret } : {}),
    }),
    cache: "no-store",
  })

  const payload = (await response.json()) as { ok?: boolean; description?: string }
  if (!response.ok || !payload.ok) {
    return {
      ok: false as const,
      error: "SET_WEBHOOK_FAILED" as const,
      detail: payload.description ?? `HTTP ${response.status}`,
    }
  }

  return { ok: true as const, url: url.toString(), description: payload.description }
}

export async function getTelegramWebhookInfo() {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim()
  if (!token) {
    return { ok: false as const, error: "NO_BOT_TOKEN" as const }
  }

  const response = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`, {
    cache: "no-store",
  })
  const payload = (await response.json()) as { ok?: boolean; result?: unknown; description?: string }
  if (!response.ok || !payload.ok) {
    return {
      ok: false as const,
      error: "GET_WEBHOOK_FAILED" as const,
      detail: payload.description ?? `HTTP ${response.status}`,
    }
  }

  return { ok: true as const, info: payload.result }
}
