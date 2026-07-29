export function hasKvRestConfig() {
  return Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN)
}

function kvConfig() {
  const url = process.env.KV_REST_API_URL
  const token = process.env.KV_REST_API_TOKEN
  if (!url || !token) return null
  return { url, token }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function kvRestGet(key: string, retries = 3): Promise<string | null> {
  const config = kvConfig()
  if (!config) return null

  for (let attempt = 0; attempt < retries; attempt += 1) {
    try {
      const response = await fetch(`${config.url}/get/${encodeURIComponent(key)}`, {
        headers: { Authorization: `Bearer ${config.token}` },
        cache: "no-store",
      })

      if (!response.ok) {
        if (attempt < retries - 1) {
          await sleep(100 * (attempt + 1))
          continue
        }
        console.error("[kv-rest] GET failed", key, response.status)
        return null
      }

      const payload = (await response.json()) as { result?: string | null }
      if (payload.result == null || payload.result === "") return null
      return payload.result
    } catch (error) {
      if (attempt < retries - 1) {
        await sleep(100 * (attempt + 1))
        continue
      }
      console.error("[kv-rest] GET error", key, error)
      return null
    }
  }

  return null
}

export async function kvRestSet(key: string, value: string, retries = 3): Promise<boolean> {
  const config = kvConfig()
  if (!config) return false

  for (let attempt = 0; attempt < retries; attempt += 1) {
    try {
      const response = await fetch(`${config.url}/set/${encodeURIComponent(key)}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${config.token}` },
        body: value,
        cache: "no-store",
      })

      if (response.ok) return true
      if (attempt < retries - 1) {
        await sleep(100 * (attempt + 1))
        continue
      }
      console.error("[kv-rest] SET failed", key, response.status)
      return false
    } catch (error) {
      if (attempt < retries - 1) {
        await sleep(100 * (attempt + 1))
        continue
      }
      console.error("[kv-rest] SET error", key, error)
      return false
    }
  }

  return false
}

export async function kvRestDel(key: string): Promise<boolean> {
  const config = kvConfig()
  if (!config) return false

  const response = await fetch(`${config.url}/del/${encodeURIComponent(key)}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${config.token}` },
    cache: "no-store",
  })

  return response.ok
}

export async function kvRestSadd(key: string, ...members: string[]): Promise<boolean> {
  const config = kvConfig()
  if (!config || members.length === 0) return false

  const path = members.map((member) => encodeURIComponent(member)).join("/")
  const response = await fetch(`${config.url}/sadd/${encodeURIComponent(key)}/${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${config.token}` },
    cache: "no-store",
  })

  return response.ok
}

export async function kvRestSmembers(key: string): Promise<string[]> {
  const config = kvConfig()
  if (!config) return []

  const response = await fetch(`${config.url}/smembers/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${config.token}` },
    cache: "no-store",
  })

  if (!response.ok) return []
  const payload = (await response.json()) as { result?: string[] | null }
  return payload.result ?? []
}

export async function kvRestMget<T>(keys: string[]): Promise<Array<T | null>> {
  const config = kvConfig()
  if (!config || keys.length === 0) return []

  const path = keys.map((key) => encodeURIComponent(key)).join("/")
  const response = await fetch(`${config.url}/mget/${path}`, {
    headers: { Authorization: `Bearer ${config.token}` },
    cache: "no-store",
  })

  if (!response.ok) return keys.map(() => null)

  const payload = (await response.json()) as { result?: Array<string | null> }
  const rows = payload.result ?? []

  return rows.map((raw) => {
    if (!raw) return null
    try {
      return JSON.parse(raw) as T
    } catch {
      return null
    }
  })
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
