import { readSubscriptionStore, writeSubscriptionStore } from "@/lib/server/subscription-store"

const USERS_KEY = "kopilka:telegram-users"

export interface TelegramUserRecord {
  telegramUserId: number
  username: string | null
  firstName: string | null
  userKey: string
  updatedAt: string
}

interface TelegramUsersSnapshot {
  byUserKey: Record<string, TelegramUserRecord>
  byUsername: Record<string, string>
}

async function readFromKv(): Promise<TelegramUsersSnapshot | null> {
  const url = process.env.KV_REST_API_URL
  const token = process.env.KV_REST_API_TOKEN
  if (!url || !token) return null

  const response = await fetch(`${url}/get/${encodeURIComponent(USERS_KEY)}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  })
  if (!response.ok) return null

  const payload = (await response.json()) as { result?: string | null }
  if (!payload.result) return { byUserKey: {}, byUsername: {} }
  return JSON.parse(payload.result) as TelegramUsersSnapshot
}

async function writeToKv(snapshot: TelegramUsersSnapshot) {
  const url = process.env.KV_REST_API_URL
  const token = process.env.KV_REST_API_TOKEN
  if (!url || !token) return false

  const response = await fetch(
    `${url}/set/${encodeURIComponent(USERS_KEY)}/${encodeURIComponent(JSON.stringify(snapshot))}`,
    { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" },
  )
  return response.ok
}

async function readUsers(): Promise<TelegramUsersSnapshot> {
  const fromKv = await readFromKv()
  return fromKv ?? { byUserKey: {}, byUsername: {} }
}

async function writeUsers(snapshot: TelegramUsersSnapshot) {
  await writeToKv(snapshot)
}

export async function registerTelegramUser(input: {
  telegramUserId: number
  username?: string | null
  firstName?: string | null
}) {
  const userKey = `tg-${input.telegramUserId}`
  const snapshot = await readUsers()
  const username = input.username?.replace(/^@/, "").toLowerCase() || null

  const record: TelegramUserRecord = {
    telegramUserId: input.telegramUserId,
    username,
    firstName: input.firstName?.trim() || null,
    userKey,
    updatedAt: new Date().toISOString(),
  }

  snapshot.byUserKey[userKey] = record
  if (username) {
    snapshot.byUsername[username] = userKey
  }

  await writeUsers(snapshot)
  return record
}

export async function findTelegramUserByUsername(username: string) {
  const normalized = username.replace(/^@/, "").toLowerCase()
  const snapshot = await readUsers()
  const userKey = snapshot.byUsername[normalized]
  if (!userKey) return null
  return snapshot.byUserKey[userKey] ?? null
}

export async function listRegisteredTelegramUsers() {
  const snapshot = await readUsers()
  return Object.values(snapshot.byUserKey)
}
