import { NextResponse } from "next/server"
import {
  getServerSubscriptionStatus,
  tryActivatePendingPaymentForUser,
} from "@/lib/server/subscription-service"

export async function GET(request: Request) {
  const userKey = new URL(request.url).searchParams.get("userKey")?.trim()
  if (!userKey) {
    return NextResponse.json({ error: "MISSING_USER_KEY" }, { status: 400 })
  }

  await tryActivatePendingPaymentForUser(userKey)
  const status = await getServerSubscriptionStatus(userKey)
  return NextResponse.json({ subscription: status })
}
