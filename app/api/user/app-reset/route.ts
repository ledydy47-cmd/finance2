import { NextResponse } from "next/server"
import { applyAppReset, consumeAppReset } from "@/lib/server/app-reset"
import { createDefaultData } from "@/lib/default-data"

export async function GET(request: Request) {
  const userKey = new URL(request.url).searchParams.get("userKey")?.trim()
  if (!userKey) {
    return NextResponse.json({ error: "MISSING_USER_KEY" }, { status: 400 })
  }

  try {
    const reset = await consumeAppReset(userKey)
    if (!reset) {
      return NextResponse.json({ apply: false })
    }

    const preview = applyAppReset(createDefaultData(), reset)

    return NextResponse.json({
      apply: true,
      resetId: reset.resetId,
      settingsPatch: reset.settingsPatch,
      clearExpenseTransactions: reset.clearExpenseTransactions,
      previewSettings: preview.settings,
    })
  } catch (error) {
    console.error("[user/app-reset]", error)
    return NextResponse.json({ error: "RESET_FETCH_FAILED" }, { status: 500 })
  }
}
