export function hasKvRestConfig() {
  return Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN)
}

function kvConfig() {
  const url = process.env.KV_REST_API_URL
  const token = process.env.KV_REST_API_TOKEN
  if (!url || !token) return null
  return { url: url.replace(/\/$/, ""), token }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

type KvCommandResult = { ok: true; result: unknown } | { ok: false; error: string }

async function kvRestCommand(command: string[], retries = 3): Promise<KvCommandResult> {
  const config = kvConfig()
  if (!config) return { ok: false, error: "NO_CONFIG" }

  for (let attempt = 0; attempt < retries; attempt += 1) {
    try {
      const response = await fetch(config.url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(command),
        cache: "no-store",
      })

      const raw = await response.text()
      if (!response.ok) {
        if (attempt < retries - 1) {
          await sleep(100 * (attempt + 1))
          continue
        }
        console.error("[kv-rest] command failed", command[0], response.status, raw)
        return { ok: false, error: raw || String(response.status) }
      }

      let payload: { result?: unknown; error?: string } = {}
      try {
        payload = raw ? (JSON.parse(raw) as { result?: unknown; error?: string }) : {}
      } catch {
        payload = { result: raw }
      }

      if (payload.error) {
        console.error("[kv-rest] command error", command[0], payload.error)
        return { ok: false, error: payload.error }
      }

      return { ok: true, result: payload.result }
    } catch (error) {
      if (attempt < retries - 1) {
        await sleep(100 * (attempt + 1))
        continue
      }
      console.error("[kv-rest] command exception", command[0], error)
      return { ok: false, error: error instanceof Error ? error.message : "UNKNOWN" }
    }
  }

  return { ok: false, error: "RETRIES_EXHAUSTED" }
}

async function kvRestPipeline(commands: string[][], retries = 3): Promise<KvCommandResult> {
  const config = kvConfig()
  if (!config) return { ok: false, error: "NO_CONFIG" }

  for (let attempt = 0; attempt < retries; attempt += 1) {
    try {
      const response = await fetch(`${config.url}/pipeline`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(commands),
        cache: "no-store",
      })

      const raw = await response.text()
      if (!response.ok) {
        if (attempt < retries - 1) {
          await sleep(100 * (attempt + 1))
          continue
        }
        console.error("[kv-rest] pipeline failed", response.status, raw)
        return { ok: false, error: raw || String(response.status) }
      }

      const rows = JSON.parse(raw) as Array<{ result?: unknown; error?: string }>
      const failed = rows.find((row) => row.error)
      if (failed?.error) {
        console.error("[kv-rest] pipeline command error", failed.error)
        return { ok: false, error: failed.error }
      }

      return { ok: true, result: rows.map((row) => row.result) }
    } catch (error) {
      if (attempt < retries - 1) {
        await sleep(100 * (attempt + 1))
        continue
      }
      console.error("[kv-rest] pipeline exception", error)
      return { ok: false, error: error instanceof Error ? error.message : "UNKNOWN" }
    }
  }

  return { ok: false, error: "RETRIES_EXHAUSTED" }
}

export async function kvRestGet(key: string, retries = 3): Promise<string | null> {
  const result = await kvRestCommand(["GET", key], retries)
  if (!result.ok) return null
  if (result.result == null || result.result === "") return null
  return String(result.result)
}

export async function kvRestSet(key: string, value: string, retries = 3): Promise<boolean> {
  const result = await kvRestCommand(["SET", key, value], retries)
  return result.ok
}

export async function kvRestDel(key: string): Promise<boolean> {
  const result = await kvRestCommand(["DEL", key])
  return result.ok
}

export async function kvRestType(key: string): Promise<string | null> {
  const result = await kvRestCommand(["TYPE", key])
  if (!result.ok) return null
  return String(result.result ?? "none")
}

export async function kvRestEnsureSetIndex(key: string) {
  const type = await kvRestType(key)
  if (type && type !== "set" && type !== "none") {
    await kvRestDel(key)
  }
}

export async function kvRestSadd(key: string, ...members: string[]): Promise<boolean> {
  if (members.length === 0) return false
  await kvRestEnsureSetIndex(key)
  const result = await kvRestCommand(["SADD", key, ...members])
  return result.ok
}

export async function kvRestSmembers(key: string): Promise<string[]> {
  const type = await kvRestType(key)
  if (type && type !== "set") return []

  const result = await kvRestCommand(["SMEMBERS", key])
  if (!result.ok || !Array.isArray(result.result)) return []
  return result.result.map(String)
}

export async function kvRestMget<T>(keys: string[]): Promise<Array<T | null>> {
  if (keys.length === 0) return []

  const result = await kvRestCommand(["MGET", ...keys])
  if (!result.ok || !Array.isArray(result.result)) return keys.map(() => null)

  return result.result.map((raw) => {
    if (raw == null || raw === "") return null
    try {
      return JSON.parse(String(raw)) as T
    } catch {
      return null
    }
  })
}

export async function kvRestSetWithIndex(input: {
  recordKey: string
  value: string
  indexKey: string
  indexMember: string
}) {
  await kvRestEnsureSetIndex(input.indexKey)
  const result = await kvRestPipeline([
    ["SET", input.recordKey, input.value],
    ["SADD", input.indexKey, input.indexMember],
  ])
  return result.ok
}

export async function kvRestGetJson<T>(key: string, fallback: T): Promise<T> {
  const raw = await kvRestGet(key)
  if (!raw) return fallback

  try {
    return JSON.parse(raw) as T
  } catch (error) {
    console.error("[kv-rest] invalid JSON for key", key, error)
    return fallback
  }
}
