import { createClient, type Client } from "@libsql/client"
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql"
import * as schema from "@/lib/db/schema"

let client: Client | null = null
let db: LibSQLDatabase<typeof schema> | null = null

export function hasTursoConfig() {
  return Boolean(process.env.TURSO_DATABASE_URL?.trim())
}

export function getTursoClient() {
  if (!hasTursoConfig()) {
    throw new Error("TURSO_NOT_CONFIGURED")
  }

  if (!client) {
    client = createClient({
      url: process.env.TURSO_DATABASE_URL!,
      authToken: process.env.TURSO_AUTH_TOKEN,
    })
  }

  return client
}

export function getDb() {
  if (!db) {
    db = drizzle(getTursoClient(), { schema })
  }
  return db
}
