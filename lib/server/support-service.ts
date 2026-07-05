import { randomUUID } from "node:crypto"
import { parseTelegramUserId } from "@/lib/server/subscription-store"
import { getSupportTicket, upsertSupportTicket, listSupportTickets } from "@/lib/server/support-store"
import type { SupportTicket } from "@/lib/server/support-types"
import { sendTelegramNotification } from "@/lib/server/telegram-notify"

function nowIso() {
  return new Date().toISOString()
}

export async function createSupportTicket(input: {
  message: string
  userKey: string
  telegramUserId?: number | null
  telegramUsername?: string | null
  userName?: string | null
}) {
  const message = input.message.trim()
  if (message.length < 3) {
    return { ok: false as const, error: "MESSAGE_TOO_SHORT" as const }
  }
  if (message.length > 2000) {
    return { ok: false as const, error: "MESSAGE_TOO_LONG" as const }
  }

  const telegramUserId =
    input.telegramUserId ?? parseTelegramUserId(input.userKey)

  const ticket: SupportTicket = {
    id: randomUUID(),
    userKey: input.userKey,
    telegramUserId,
    telegramUsername: input.telegramUsername?.replace(/^@/, "") ?? null,
    userName: input.userName?.trim() || null,
    message,
    status: "open",
    reply: null,
    createdAt: nowIso(),
    repliedAt: null,
  }

  await upsertSupportTicket(ticket)
  return { ok: true as const, ticketId: ticket.id }
}

export async function replyToSupportTicket(input: { ticketId: string; reply: string }) {
  const reply = input.reply.trim()
  if (reply.length < 1) {
    return { ok: false as const, error: "REPLY_EMPTY" as const }
  }

  const ticket = await getSupportTicket(input.ticketId)
  if (!ticket) {
    return { ok: false as const, error: "NOT_FOUND" as const }
  }

  const updated: SupportTicket = {
    ...ticket,
    status: "answered",
    reply,
    repliedAt: nowIso(),
  }

  await upsertSupportTicket(updated)

  const notificationText = [
    "Ответ поддержки «Мани.точка»:",
    "",
    reply,
    "",
    "Если остались вопросы — напишите снова в разделе «Поддержка» в настройках приложения.",
  ].join("\n")

  const notifyResult = await sendTelegramNotification({
    telegramUserId: updated.telegramUserId,
    text: notificationText,
  })

  return {
    ok: true as const,
    ticket: updated,
    notified: notifyResult.ok,
  }
}

export { listSupportTickets, getSupportTicket }
