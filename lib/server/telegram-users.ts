import { eq } from "drizzle-orm"
import { getDb, hasTursoConfig } from "@/lib/db/client"
import { initTursoSchema } from "@/lib/db/init"
import { telegramUserToRecord } from "@/lib/db/mappers"
import { telegramUsers } from "@/lib/db/schema"
import { readJsonDataFile, writeJsonDataFile } from "@/lib/server/file-store"
import { hasKvRestConfig, kvRestGetJson, kvRestSet } from "@/lib/server/kv-rest"

const USERS_KEY = "kopilka:telegram-users"
const FILE_NAME = "telegram-users.json"

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

const EMPTY_USERS: TelegramUsersSnapshot = { byUserKey: {}, byUsername: {} }

let schemaReady = false

async function ensureTursoSchema() {
  if (!schemaReady) {
    await initTursoSchema()
    schemaReady = true
  }
}

async function readUsers(): Promise<TelegramUsersSnapshot> {
  if (hasTursoConfig()) {
    await ensureTursoSchema()
    const rows = await getDb().select().from(telegramUsers)
    const byUserKey: TelegramUsersSnapshot["byUserKey"] = {}
    const byUsername: TelegramUsersSnapshot["byUsername"] = {}
    for (const row of rows) {
      const record = telegramUserToRecord(row)
      byUserKey[record.userKey] = record
      if (record.username) {
        byUsername[record.username] = record.userKey
      }
    }
    return { byUserKey, byUsername }
  }

  if (hasKvRestConfig()) {
    const fromKv = await kvRestGetJson(USERS_KEY, null)
    if (fromKv) return fromKv
  }

  try {
    return await readJsonDataFile(FILE_NAME, EMPTY_USERS)
  } catch {
    return EMPTY_USERS
  }
}

async function writeUsers(snapshot: TelegramUsersSnapshot) {
  if (hasTursoConfig()) {
    await ensureTursoSchema()
    const db = getDb()
    for (const record of Object.values(snapshot.byUserKey)) {
      await db
        .insert(telegramUsers)
        .values({
          userKey: record.userKey,
          telegramUserId: record.telegramUserId,
          username: record.username,
          firstName: record.firstName,
          updatedAt: record.updatedAt,
        })
        .onConflictDoUpdate({
          target: telegramUsers.userKey,
          set: {
            telegramUserId: record.telegramUserId,
            username: record.username,
            firstName: record.firstName,
            updatedAt: record.updatedAt,
          },
        })
    }
    return
  }

  const payload = JSON.stringify(snapshot)
  if (hasKvRestConfig()) {
    const wrote = await kvRestSet(USERS_KEY, payload)
    if (wrote) return
    console.error("[telegram-users] KV write failed, falling back to file")
  }

  await writeJsonDataFile(FILE_NAME, snapshot)
}

export async function registerTelegramUser(input: {
  telegramUserId: number
  username?: string | null
  firstName?: string | null
}) {
  const userKey = `tg-${input.telegramUserId}`
  const username = input.username?.replace(/^@/, "").toLowerCase() || null

  const record: TelegramUserRecord = {
    telegramUserId: input.telegramUserId,
    username,
    firstName: input.firstName?.trim() || null,
    userKey,
    updatedAt: new Date().toISOString(),
  }

  if (hasTursoConfig()) {
    await ensureTursoSchema()
    await getDb()
      .insert(telegramUsers)
      .values({
        userKey: record.userKey,
        telegramUserId: record.telegramUserId,
        username: record.username,
        firstName: record.firstName,
        updatedAt: record.updatedAt,
      })
      .onConflictDoUpdate({
        target: telegramUsers.userKey,
        set: {
          telegramUserId: record.telegramUserId,
          username: record.username,
          firstName: record.firstName,
          updatedAt: record.updatedAt,
        },
      })
    return record
  }

  const snapshot = await readUsers()
  snapshot.byUserKey[userKey] = record
  if (username) {
    snapshot.byUsername[username] = userKey
  }
  await writeUsers(snapshot)
  return record
}

export async function findTelegramUserByUsername(username: string) {
  const normalized = username.replace(/^@/, "").toLowerCase()

  if (hasTursoConfig()) {
    await ensureTursoSchema()
    const row = await getDb()
      .select()
      .from(telegramUsers)
      .where(eq(telegramUsers.username, normalized))
      .get()
    return row ? telegramUserToRecord(row) : null
  }

  const snapshot = await readUsers()
  const userKey = snapshot.byUsername[normalized]
  if (!userKey) return null
  return snapshot.byUserKey[userKey] ?? null
}

export async function listRegisteredTelegramUsers() {
  const snapshot = await readUsers()
  return Object.values(snapshot.byUserKey)
}
