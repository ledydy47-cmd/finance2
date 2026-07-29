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
const TICKET_INDEX_KEY = "kopilka:support:ticket-index"
const TICKET_RECORD_PREFIX = "kopilka:support:ticket:"
const FILE_PATH = path.join(process.cwd(), "data", "support-tickets.json")
const EMPTY_STORE: SupportStoreSnapshot = { tickets: {} }
const MGET_BATCH_SIZE = 25

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

function isSupportFullyMigrated(indexCount: number, legacyCount: number) {
  if (legacyCount === 0) return indexCount > 0
  return indexCount >= legacyCount * 0.95
}

async function loadShardedTickets(
  ticketIds: string[],
  legacy: SupportStoreSnapshot | null,
): Promise<Record<string, SupportTicket>> {
  const tickets: Record<string, SupportTicket> = { ...(legacy?.tickets ?? {}) }

  for (let offset = 0; offset < ticketIds.length; offset += MGET_BATCH_SIZE) {
    const chunk = ticketIds.slice(offset, offset + MGET_BATCH_SIZE)
    const records = await kvRestMget<SupportTicket>(chunk.map(ticketRecordKey))
    chunk.forEach((ticketId, index) => {
      const ticket = records[index] ?? legacy?.tickets[ticketId]
      if (ticket) {
        tickets[ticketId] = ticket
      }
    })
  }

  return tickets
}

async function readSupportStore(): Promise<SupportStoreSnapshot> {
  if (!hasKvRestConfig()) {
    return readFromFile()
  }

  const legacy = await readLegacySupportSnapshot()
  const legacyCount = legacy?.tickets ? Object.keys(legacy.tickets).length : 0
  const ticketIds = await kvRestSmembers(TICKET_INDEX_KEY)

  if (ticketIds.length === 0) {
    return legacy ?? EMPTY_STORE
  }

  if (legacyCount > 0 && !isSupportFullyMigrated(ticketIds.length, legacyCount)) {
    const tickets = await loadShardedTickets(ticketIds, legacy)
    if (Object.keys(tickets).length >= legacyCount) {
      return { tickets }
    }
    return legacy
  }

  const tickets = await loadShardedTickets(ticketIds, legacy)
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
  if (hasKvRestConfig()) {
    const fromShard = await kvRestGetJson<SupportTicket | null>(ticketRecordKey(id), null)
    if (fromShard) return fromShard
  }

  const legacy = await readLegacySupportSnapshot()
  return legacy?.tickets[id] ?? null
}

export async function upsertSupportTicket(ticket: SupportTicket) {
  if (hasKvRestConfig()) {
    await saveSupportTicketRecord(ticket)
    return ticket
  }

  const store = await readFromFile()
  store.tickets[ticket.id] = ticket
  await writeSupportStore(store)
  return ticket
}
