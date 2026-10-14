import { NextResponse } from "next/server"
import {
  readAdminNotifyRecipients,
  writeAdminNotifyRecipients,
  type AdminNotifyRecipientRecord,
} from "@/lib/server/admin-notify-recipients-store"
import { getAdminTelegramUserId } from "@/lib/server/admin-telegram-notify"
import { findTelegramUserByUsername } from "@/lib/server/telegram-users"

function isAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret) return false

  const header = request.headers.get("authorization")
  if (header === `Bearer ${secret}`) return true

  const url = new URL(request.url)
  return url.searchParams.get("secret") === secret
}

function normalizeUsername(value: string | null | undefined) {
  const handle = value?.trim().replace(/^@/, "").toLowerCase()
  return handle || null
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 })
  }

  const snapshot = await readAdminNotifyRecipients()
  const primary = getAdminTelegramUserId()

  const recipients = await Promise.all(
    (snapshot.recipients ?? []).map(async (recipient) => {
      const byUsername = recipient.username
        ? await findTelegramUserByUsername(recipient.username)
        : null
      const telegramUserId = recipient.telegramUserId ?? byUsername?.telegramUserId ?? null
      return {
        ...recipient,
        resolvedTelegramUserId: telegramUserId,
        reachable: telegramUserId !== null && telegramUserId !== primary,
      }
    }),
  )

  return NextResponse.json({ ok: true, primaryTelegramUserId: primary, recipients })
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 })
  }

  try {
    const body = (await request.json()) as Partial<AdminNotifyRecipientRecord>

    const username = normalizeUsername(body.username)
    const telegramUserId = body.telegramUserId ? Number(body.telegramUserId) : null

    if (!username && !telegramUserId) {
      return NextResponse.json({ error: "USERNAME_OR_ID_REQUIRED" }, { status: 400 })
    }

    const snapshot = await readAdminNotifyRecipients()
    const recipients = snapshot.recipients ?? []

    const alreadyThere = recipients.some((recipient) => {
      if (username && recipient.username === username) return true
      if (telegramUserId && recipient.telegramUserId === telegramUserId) return true
      return false
    })

    if (!alreadyThere) {
      recipients.push({
        username,
        telegramUserId,
        label: body.label?.trim() || (username ? `@${username}` : `id ${telegramUserId}`),
        purchaseNotifications: body.purchaseNotifications !== false,
        addedAt: new Date().toISOString(),
      })
      await writeAdminNotifyRecipients({ recipients })
    }

    const resolved = username ? await findTelegramUserByUsername(username) : null

    return NextResponse.json({
      ok: true,
      added: !alreadyThere,
      recipients,
      resolvedTelegramUserId: telegramUserId ?? resolved?.telegramUserId ?? null,
    })
  } catch (error) {
    console.error("[admin/notify-recipients] POST failed", error)
    return NextResponse.json({ error: "BAD_REQUEST" }, { status: 400 })
  }
}

export async function DELETE(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 })
  }

  const url = new URL(request.url)
  const username = normalizeUsername(url.searchParams.get("username"))
  const telegramUserId = Number(url.searchParams.get("telegramUserId") ?? "")

  if (!username && !Number.isFinite(telegramUserId)) {
    return NextResponse.json({ error: "USERNAME_OR_ID_REQUIRED" }, { status: 400 })
  }

  const snapshot = await readAdminNotifyRecipients()
  const recipients = (snapshot.recipients ?? []).filter((recipient) => {
    if (username && recipient.username === username) return false
    if (Number.isFinite(telegramUserId) && recipient.telegramUserId === telegramUserId) return false
    return true
  })

  await writeAdminNotifyRecipients({ recipients })

  return NextResponse.json({ ok: true, recipients })
}
