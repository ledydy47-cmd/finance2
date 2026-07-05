import { NextResponse } from "next/server"
import { resumeAutoRenewal } from "@/lib/server/subscription-service"

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { userKey?: string }
    if (!body.userKey?.trim()) {
      return NextResponse.json({ error: "MISSING_USER_KEY" }, { status: 400 })
    }

    const result = await resumeAutoRenewal(body.userKey.trim())
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 404 })
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error("[subscription/resume-renewal]", error)
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 })
  }
}
