import { kvRestGet, kvRestSet } from "@/lib/server/kv-rest"
import { getAppBaseUrl } from "@/lib/yookassa/server"

const TOKEN_KEY = "kopilka:config:qstash_token"
const URL_KEY = "kopilka:config:qstash_url"

export async function getQStashToken() {
  return (
    process.env.QSTASH_TOKEN?.trim() ||
    process.env.UPSTASH_QSTASH_TOKEN?.trim() ||
    process.env.UPSTASH_QSTASH_REST_TOKEN?.trim() ||
    (await kvRestGet(TOKEN_KEY)) ||
    null
  )
}

export async function getQStashUrl() {
  const fromEnv =
    process.env.QSTASH_URL?.trim() ||
    process.env.UPSTASH_QSTASH_URL?.trim() ||
    null

  if (fromEnv) return fromEnv.replace(/\/$/, "")

  const fromKv = await kvRestGet(URL_KEY)
  if (fromKv) return fromKv.replace(/\/$/, "")

  return "https://qstash.upstash.io"
}

export async function saveQStashConfig(input: { token: string; url?: string }) {
  const tokenSaved = await kvRestSet(TOKEN_KEY, input.token.trim())
  const urlSaved = input.url?.trim()
    ? await kvRestSet(URL_KEY, input.url.trim().replace(/\/$/, ""))
    : true

  return { tokenSaved, urlSaved }
}

export async function getQStashConfigStatus() {
  const [token, url] = await Promise.all([getQStashToken(), getQStashUrl()])
  const appUrl = getAppBaseUrl()
  return {
    hasToken: Boolean(token),
    hasUrl: Boolean(url),
    hasAppUrl: Boolean(appUrl),
    hasCronSecret: Boolean(process.env.CRON_SECRET),
    appUrl,
    tokenSource: process.env.QSTASH_TOKEN
      ? "env"
      : process.env.UPSTASH_QSTASH_TOKEN
        ? "upstash_env"
        : token
          ? "kv"
          : "missing",
  }
}
