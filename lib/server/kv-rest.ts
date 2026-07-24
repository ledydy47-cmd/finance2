export function hasKvRestConfig() {
  return Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN)
}

export async function kvRestGet(key: string): Promise<string | null> {
  const url = process.env.KV_REST_API_URL
  const token = process.env.KV_REST_API_TOKEN
  if (!url || !token) return null

  const response = await fetch(`${url}/get/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  })

  if (!response.ok) return null
  const payload = (await response.json()) as { result?: string | null }
  if (payload.result == null || payload.result === "") return null
  return payload.result
}

export async function kvRestSet(key: string, value: string): Promise<boolean> {
  const url = process.env.KV_REST_API_URL
  const token = process.env.KV_REST_API_TOKEN
  if (!url || !token) return false

  const response = await fetch(`${url}/set/${encodeURIComponent(key)}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: value,
    cache: "no-store",
  })

  return response.ok
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
