import nodemailer from "nodemailer"
import type { SupportTicket } from "@/lib/server/support-types"
import { getAppBaseUrl } from "@/lib/yookassa/server"

const DEFAULT_SUPPORT_NOTIFY_EMAIL = "parshinadiana@yandex.ru"

function formatUser(ticket: SupportTicket) {
  return [
    ticket.userName,
    ticket.telegramUsername ? `@${ticket.telegramUsername}` : null,
    ticket.telegramUserId ? `id ${ticket.telegramUserId}` : ticket.userKey,
  ]
    .filter(Boolean)
    .join(" · ")
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("ru-RU", {
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function buildEmailContent(ticket: SupportTicket) {
  const user = formatUser(ticket)
  const adminUrl = `${getAppBaseUrl()}/admin/support?tab=support`
  const subject = `Новый вопрос в поддержке · ${user}`
  const text = [
    "Новое обращение в поддержку «Мани.точка»",
    "",
    `Пользователь: ${user}`,
    `Время: ${formatDateTime(ticket.createdAt)}`,
    "",
    "Сообщение:",
    ticket.message,
    "",
    `Ответить: ${adminUrl}`,
  ].join("\n")

  const html = `
    <h2>Новое обращение в поддержку «Мани.точка»</h2>
    <p><strong>Пользователь:</strong> ${escapeHtml(user)}</p>
    <p><strong>Время:</strong> ${escapeHtml(formatDateTime(ticket.createdAt))}</p>
    <p><strong>Сообщение:</strong></p>
    <blockquote style="margin:0;padding:12px 16px;background:#f5f5f5;border-radius:8px;white-space:pre-wrap">${escapeHtml(ticket.message)}</blockquote>
    <p style="margin-top:20px"><a href="${escapeHtml(adminUrl)}">Открыть админ-панель →</a></p>
  `.trim()

  return { subject, text, html }
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

async function sendWithResend(to: string, subject: string, text: string, html: string) {
  const apiKey = process.env.RESEND_API_KEY?.trim()
  if (!apiKey) return { ok: false as const, reason: "NOT_CONFIGURED" as const }

  const from =
    process.env.RESEND_FROM_EMAIL?.trim() || "Мани.точка <onboarding@resend.dev>"

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject,
      text,
      html,
    }),
  })

  if (!response.ok) {
    const details = await response.text()
    throw new Error(`Resend failed: ${response.status} ${details}`)
  }

  return { ok: true as const }
}

async function sendWithSmtp(
  to: string,
  subject: string,
  text: string,
  html: string,
  user: string,
  pass: string,
) {
  const host = process.env.SMTP_HOST?.trim() || "smtp.yandex.ru"
  const port = Number(process.env.SMTP_PORT ?? "465")

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  })

  await transporter.sendMail({
    from: process.env.SMTP_FROM?.trim() || user,
    to,
    subject,
    text,
    html,
  })

  return { ok: true as const }
}

export async function notifyNewSupportTicket(ticket: SupportTicket) {
  const to = process.env.SUPPORT_NOTIFY_EMAIL?.trim() || DEFAULT_SUPPORT_NOTIFY_EMAIL
  const { subject, text, html } = buildEmailContent(ticket)

  if (process.env.RESEND_API_KEY?.trim()) {
    return sendWithResend(to, subject, text, html)
  }

  const smtpUser = process.env.SMTP_USER?.trim()
  const smtpPass = process.env.SMTP_PASS?.trim()
  if (smtpUser && smtpPass) {
    return sendWithSmtp(to, subject, text, html, smtpUser, smtpPass)
  }

  console.warn(
    "[support/email] Skipping notification — set RESEND_API_KEY or SMTP_USER/SMTP_PASS in Vercel",
  )
  return { ok: false as const, reason: "NOT_CONFIGURED" as const }
}
