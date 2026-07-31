import { NextResponse } from "next/server"
import { getUserProgressFlags } from "@/lib/server/user-progress-service"

export async function GET(request: Request) {
  const userKey = new URL(request.url).searchParams.get("userKey")?.trim()
  if (!userKey) {
    return NextResponse.json({ error: "MISSING_USER_KEY" }, { status: 400 })
  }

  try {
    const progress = await getUserProgressFlags(userKey)
    return NextResponse.json({ ok: true, progress })
  } catch (error) {
    console.error("[user/progress]", error)
    return NextResponse.json({ error: "PROGRESS_FAILED" }, { status: 500 })
  }
}
