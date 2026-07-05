import fs from "fs/promises"
import path from "path"
import type { SupportStoreSnapshot, SupportTicket } from "@/lib/server/support-types"

const STORE_KEY = "kopilka:support-tickets"
const FILE_PATH = path.join(process.cwd(), "data", "support-tickets.json")

async function readFromKv(): Promise<SupportStoreSnapshot | null> {
  const url = process.env.KV_REST_API_URL
  const token = process.env.KV_REST_API_TOKEN
  if (!url || !token) return null

  const response = await fetch(`${url}/get/${encodeURIComponent(STORE_KEY)}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  })

  if (!response.ok) return null
  const payload = (await response.json()) as { result?: string | null }
  if (!payload.result) return { tickets: {} }
  return JSON.parse(payload.result) as SupportStoreSnapshot
}

async function writeToKv(snapshot: SupportStoreSnapshot) {
  const url = process.env.KV_REST_API_URL
  const token = process.env.KV_REST_API_TOKEN
  if (!url || !token) return false

  const response = await fetch(
    `${url}/set/${encodeURIComponent(STORE_KEY)}/${encodeURIComponent(JSON.stringify(snapshot))}`,
    { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" },
  )
  return response.ok
}

async function readFromFile(): Promise<SupportStoreSnapshot> {
  try {
    const raw = await fs.readFile(FILE_PATH, "utf8")
    return JSON.parse(raw) as SupportStoreSnapshot
  } catch {
    return { tickets: {} }
  }
}

async function writeToFile(snapshot: SupportStoreSnapshot) {
  await fs.mkdir(path.dirname(FILE_PATH), { recursive: true })
  await fs.writeFile(FILE_PATH, JSON.stringify(snapshot, null, 2), "utf8")
}

export async function readSupportStore(): Promise<SupportStoreSnapshot> {
  const fromKv = await readFromKv()
  if (fromKv) return fromKv
  return readFromFile()
}

export async function writeSupportStore(snapshot: SupportStoreSnapshot) {
  const wroteKv = await writeToKv(snapshot)
  if (!wroteKv) {
    await writeToFile(snapshot)
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
