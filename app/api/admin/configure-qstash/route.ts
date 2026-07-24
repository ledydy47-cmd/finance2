import { NextResponse } from "next/server"
import { getQStashConfigStatus, saveQStashConfig } from "@/lib/server/qstash-config"

function isAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret) return false

  const header = request.headers.get("authorization")
  if (header === `Bearer ${secret}`) return true

  const url = new URL(request.url)
  return url.searchParams.get("secret") === secret
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 })
  }

  return NextResponse.json({ ok: true, ...(await getQStashConfigStatus()) })
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 })
  }

  try {
    const body = (await request.json()) as {
      token?: string
      url?: string
    }

    if (!body.token?.trim()) {
      return NextResponse.json({ error: "MISSING_TOKEN" }, { status: 400 })
    }

    const saved = await saveQStashConfig({
      token: body.token,
      url: body.url,
    })

    return NextResponse.json({
      ok: true,
      saved,
      ...(await getQStashConfigStatus()),
    })
  } catch (error) {
    console.error("[admin/configure-qstash]", error)
    return NextResponse.json({ error: "CONFIGURE_FAILED" }, { status: 500 })
  }
}
