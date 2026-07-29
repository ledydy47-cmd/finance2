import { NextResponse } from "next/server"
import { isAdminSupportAuthorized } from "@/lib/server/admin-auth"
import { hasKvRestConfig, kvRestGet, kvRestGetJson } from "@/lib/server/kv-rest"

export const maxDuration = 60

const KEYS = {
  subscriptions: "kopilka:subscriptions",
  analytics: "kopilka:user-analytics",
  support: "kopilka:support-tickets",
  telegramUsers: "kopilka:telegram-users",
} as const

export async function GET(request: Request) {
  if (!isAdminSupportAuthorized(request)) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 })
  }

  if (!hasKvRestConfig()) {
    return NextResponse.json({ error: "NO_KV_CONFIG" }, { status: 503 })
  }

  const store = new URL(request.url).searchParams.get("store")
  if (store && store in KEYS) {
    const key = KEYS[store as keyof typeof KEYS]
    const raw = store === "analytics" ? await kvRestGet(key) : null
    if (raw) {
      try {
        return NextResponse.json(JSON.parse(raw))
      } catch {
        return NextResponse.json({ error: "INVALID_JSON" }, { status: 500 })
      }
    }
    const json = await kvRestGetJson(key, null)
    return NextResponse.json(json ?? {})
  }

  const [subscriptions, analytics, support, telegramUsers] = await Promise.all([
    kvRestGetJson(KEYS.subscriptions, null),
    kvRestGet(KEYS.analytics),
    kvRestGetJson(KEYS.support, null),
    kvRestGetJson(KEYS.telegramUsers, null),
  ])

  let analyticsParsed: unknown = null
  if (analytics) {
    try {
      analyticsParsed = JSON.parse(analytics)
    } catch {
      analyticsParsed = null
    }
  }

  return NextResponse.json({
    subscriptions,
    support,
    telegramUsers,
    analyticsUserCount:
      analyticsParsed &&
      typeof analyticsParsed === "object" &&
      analyticsParsed !== null &&
      "users" in analyticsParsed &&
      typeof (analyticsParsed as { users: unknown }).users === "object"
        ? Object.keys((analyticsParsed as { users: Record<string, unknown> }).users).length
        : 0,
    subscriptionCount: subscriptions?.records ? Object.keys(subscriptions.records).length : 0,
  })
}
