import { NextResponse } from "next/server"
import { isYooKassaConfigured } from "@/lib/yookassa/server"

export async function GET() {
  return NextResponse.json({ configured: isYooKassaConfigured() })
}
