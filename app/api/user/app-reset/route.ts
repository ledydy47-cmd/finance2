import { NextResponse } from "next/server"
import { acknowledgeAppReset, applyAppReset, peekAppReset } from "@/lib/server/app-reset"
import { createDefaultData } from "@/lib/default-data"

export async function GET(request: Request) {
  const userKey = new URL(request.url).searchParams.get("userKey")?.trim()
  if (!userKey) {
    return NextResponse.json({ error: "MISSING_USER_KEY" }, { status: 400 })
  }

  try {
    const reset = await peekAppReset(userKey)
    if (!reset) {
      return NextResponse.json({ apply: false })
    }

    const preview = applyAppReset(createDefaultData(), reset)

    return NextResponse.json({
      apply: true,
      resetId: reset.resetId,
      settingsPatch: reset.settingsPatch,
      clearExpenseTransactions: reset.clearExpenseTransactions,
      resetToOnboarding: reset.resetToOnboarding ?? false,
      previewSettings: preview.settings,
    })
  } catch (error) {
    console.error("[user/app-reset]", error)
    return NextResponse.json({ error: "RESET_FETCH_FAILED" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { userKey?: string; resetId?: string }
    const userKey = body.userKey?.trim()
    const resetId = body.resetId?.trim()
    if (!userKey || !resetId) {
      return NextResponse.json({ error: "MISSING_RESET_ACK" }, { status: 400 })
    }

    const acknowledged = await acknowledgeAppReset(userKey, resetId)
    return NextResponse.json({ ok: acknowledged })
  } catch (error) {
    console.error("[user/app-reset] ack", error)
    return NextResponse.json({ error: "RESET_ACK_FAILED" }, { status: 500 })
  }
}
