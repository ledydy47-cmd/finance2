import fs from "fs/promises"
import path from "path"
import { kvRestGetJson, kvRestSet } from "@/lib/server/kv-rest"
import type { SupportStoreSnapshot, SupportTicket } from "@/lib/server/support-types"

const STORE_KEY = "kopilka:support-tickets"
const FILE_PATH = path.join(process.cwd(), "data", "support-tickets.json")
const EMPTY_STORE: SupportStoreSnapshot = { tickets: {} }

async function readFromFile(): Promise<SupportStoreSnapshot> {
  try {
    const raw = await fs.readFile(FILE_PATH, "utf8")
    return JSON.parse(raw) as SupportStoreSnapshot
  } catch {
    return EMPTY_STORE
  }
}

export async function readSupportStore(): Promise<SupportStoreSnapshot> {
  const fromKv = await kvRestGetJson(STORE_KEY, null)
  if (fromKv) return fromKv
  return readFromFile()
}

export async function writeSupportStore(snapshot: SupportStoreSnapshot) {
  const payload = JSON.stringify(snapshot)
  const wroteKv = await kvRestSet(STORE_KEY, payload)
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
  const store = await readSupportStore()
  return store.tickets[id] ?? null
}

export async function upsertSupportTicket(ticket: SupportTicket) {
  const store = await readSupportStore()
  store.tickets[ticket.id] = ticket
  await writeSupportStore(store)
  return ticket
}
