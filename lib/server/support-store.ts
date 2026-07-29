import { desc, eq } from "drizzle-orm"
import { getDb, hasTursoConfig } from "@/lib/db/client"
import { initTursoSchema } from "@/lib/db/init"
import { supportTicketToRecord, supportTicketToRow } from "@/lib/db/mappers"
import { supportTickets } from "@/lib/db/schema"
import { readJsonDataFile, writeJsonDataFile } from "@/lib/server/file-store"
import { hasKvRestConfig, kvRestGetJson, kvRestSet } from "@/lib/server/kv-rest"
import type { SupportStoreSnapshot, SupportTicket } from "@/lib/server/support-types"

const STORE_KEY = "kopilka:support-tickets"
const FILE_NAME = "support-tickets.json"
const EMPTY_STORE: SupportStoreSnapshot = { tickets: {} }

let schemaReady = false

async function ensureTursoSchema() {
  if (!schemaReady) {
    await initTursoSchema()
    schemaReady = true
  }
}

export async function readSupportStore(): Promise<SupportStoreSnapshot> {
  if (hasTursoConfig()) {
    await ensureTursoSchema()
    const rows = await getDb().select().from(supportTickets)
    const tickets: SupportStoreSnapshot["tickets"] = {}
    for (const row of rows) {
      const ticket = supportTicketToRecord(row)
      tickets[ticket.id] = ticket
    }
    return { tickets }
  }

  if (hasKvRestConfig()) {
    const fromKv = await kvRestGetJson(STORE_KEY, null)
    if (fromKv) return fromKv
  }
  return readJsonDataFile(FILE_NAME, EMPTY_STORE)
}

export async function writeSupportStore(snapshot: SupportStoreSnapshot) {
  if (hasTursoConfig()) {
    await ensureTursoSchema()
    const db = getDb()
    for (const ticket of Object.values(snapshot.tickets)) {
      await db
        .insert(supportTickets)
        .values(supportTicketToRow(ticket))
        .onConflictDoUpdate({
          target: supportTickets.id,
          set: supportTicketToRow(ticket),
        })
    }
    return
  }

  const payload = JSON.stringify(snapshot)
  if (hasKvRestConfig()) {
    const wroteKv = await kvRestSet(STORE_KEY, payload)
    if (wroteKv) return
    console.error("[support-store] KV write failed, falling back to file")
  }

  await writeJsonDataFile(FILE_NAME, snapshot)
}

export async function listSupportTickets() {
  if (hasTursoConfig()) {
    await ensureTursoSchema()
    const rows = await getDb().select().from(supportTickets).orderBy(desc(supportTickets.createdAt))
    return rows.map(supportTicketToRecord)
  }

  const store = await readSupportStore()
  return Object.values(store.tickets).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  )
}

export async function getSupportTicket(id: string) {
  if (hasTursoConfig()) {
    await ensureTursoSchema()
    const row = await getDb().select().from(supportTickets).where(eq(supportTickets.id, id)).get()
    return row ? supportTicketToRecord(row) : null
  }

  const store = await readSupportStore()
  return store.tickets[id] ?? null
}

export async function upsertSupportTicket(ticket: SupportTicket) {
  if (hasTursoConfig()) {
    await ensureTursoSchema()
    await getDb()
      .insert(supportTickets)
      .values(supportTicketToRow(ticket))
      .onConflictDoUpdate({
        target: supportTickets.id,
        set: supportTicketToRow(ticket),
      })
    return ticket
  }

  const store = await readSupportStore()
  store.tickets[ticket.id] = ticket
  await writeSupportStore(store)
  return ticket
}
