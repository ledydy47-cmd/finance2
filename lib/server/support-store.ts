import fs from "fs/promises"
import path from "path"
import {
  hasKvRestConfig,
  kvRestGet,
  kvRestGetJson,
  kvRestMget,
  kvRestSadd,
  kvRestSet,
  kvRestSmembers,
} from "@/lib/server/kv-rest"
import type { SupportStoreSnapshot, SupportTicket } from "@/lib/server/support-types"

const LEGACY_STORE_KEY = "kopilka:support-tickets"
const SUPPORT_MIGRATED_KEY = "kopilka:support:v2-migrated"
const TICKET_INDEX_KEY = "kopilka:support:ticket-index"
const TICKET_RECORD_PREFIX = "kopilka:support:ticket:"
const FILE_PATH = path.join(process.cwd(), "data", "support-tickets.json")
const EMPTY_STORE: SupportStoreSnapshot = { tickets: {} }
const MGET_BATCH_SIZE = 100

function ticketRecordKey(ticketId: string) {
  return `${TICKET_RECORD_PREFIX}${ticketId}`
}

async function readFromFile(): Promise<SupportStoreSnapshot> {
  try {
    const raw = await fs.readFile(FILE_PATH, "utf8")
    return JSON.parse(raw) as SupportStoreSnapshot
  } catch {
    return EMPTY_STORE
  }
}

async function readLegacySupportSnapshot(): Promise<SupportStoreSnapshot | null> {
  if (hasKvRestConfig()) {
    const raw = await kvRestGet(LEGACY_STORE_KEY, 5)
    if (raw) {
      try {
        return JSON.parse(raw) as SupportStoreSnapshot
      } catch (error) {
        console.error("[support-store] invalid legacy KV payload", error)
      }
    }
  }

  const fromFile = await readFromFile()
  if (Object.keys(fromFile.tickets).length > 0) {
    return fromFile
  }

  return null
}

async function saveSupportTicketRecord(ticket: SupportTicket) {
  const wrote = await kvRestSet(ticketRecordKey(ticket.id), JSON.stringify(ticket))
  if (!wrote) {
    throw new Error(`SUPPORT_TICKET_WRITE_FAILED:${ticket.id}`)
  }
  await kvRestSadd(TICKET_INDEX_KEY, ticket.id)
}

export async function ensureSupportMigrated() {
  if (!hasKvRestConfig()) return

  const migrated = await kvRestGetJson<boolean>(SUPPORT_MIGRATED_KEY, false)
  if (migrated) return

  const legacy = await readLegacySupportSnapshot()
  if (legacy?.tickets) {
    for (const ticket of Object.values(legacy.tickets)) {
      await saveSupportTicketRecord(ticket)
    }
  }

  await kvRestSet(SUPPORT_MIGRATED_KEY, "true")
}

async function readSupportStore(): Promise<SupportStoreSnapshot> {
  await ensureSupportMigrated()

  if (!hasKvRestConfig()) {
    return readFromFile()
  }

  const ticketIds = await kvRestSmembers(TICKET_INDEX_KEY)
  if (ticketIds.length === 0) {
    return EMPTY_STORE
  }

  const tickets: Record<string, SupportTicket> = {}

  for (let offset = 0; offset < ticketIds.length; offset += MGET_BATCH_SIZE) {
    const chunk = ticketIds.slice(offset, offset + MGET_BATCH_SIZE)
    const records = await kvRestMget<SupportTicket>(chunk.map(ticketRecordKey))
    chunk.forEach((ticketId, index) => {
      const ticket = records[index]
      if (ticket) {
        tickets[ticketId] = ticket
      }
    })
  }

  return { tickets }
}

export async function writeSupportStore(snapshot: SupportStoreSnapshot) {
  const payload = JSON.stringify(snapshot)
  const wroteKv = await kvRestSet(LEGACY_STORE_KEY, payload)
  if (wroteKv) return

  try {
    await fs.mkdir(path.dirname(FILE_PATH), { recursive: true })
    await fs.writeFile(FILE_PATH, payload, "utf8")
  } catch (error) {
    console.error("[support-store] write failed", error)
    throw error
  }
}

export async function listSupportTickets() {
  const store = await readSupportStore()
  return Object.values(store.tickets).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  )
}

export async function getSupportTicket(id: string) {
  await ensureSupportMigrated()
  if (hasKvRestConfig()) {
    return kvRestGetJson<SupportTicket | null>(ticketRecordKey(id), null)
  }

  const store = await readFromFile()
  return store.tickets[id] ?? null
}

export async function upsertSupportTicket(ticket: SupportTicket) {
  await ensureSupportMigrated()
  if (hasKvRestConfig()) {
    await saveSupportTicketRecord(ticket)
    return ticket
  }

  const store = await readFromFile()
  store.tickets[ticket.id] = ticket
  await writeSupportStore(store)
  return ticket
}
