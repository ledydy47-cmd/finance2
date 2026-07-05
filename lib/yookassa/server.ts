import type { SubscriptionPlan } from "@/lib/subscription"

export interface YooKassaAmount {
  value: string
  currency: string
}

export interface YooKassaPayment {
  id: string
  status: "pending" | "waiting_for_capture" | "succeeded" | "canceled"
  paid: boolean
  amount: YooKassaAmount
  metadata?: {
    plan?: SubscriptionPlan
    userKey?: string
    orderId?: string
  }
  confirmation?: {
    type: string
    confirmation_url?: string
  }
}

function getCredentials() {
  const shopId = process.env.YOOKASSA_SHOP_ID
  const secretKey = process.env.YOOKASSA_SECRET_KEY
  if (!shopId || !secretKey) {
    throw new Error("YOOKASSA_NOT_CONFIGURED")
  }
  return { shopId, secretKey }
}

function authHeader() {
  const { shopId, secretKey } = getCredentials()
  const token = Buffer.from(`${shopId}:${secretKey}`).toString("base64")
  return `Basic ${token}`
}

export function isYooKassaConfigured() {
  return Boolean(process.env.YOOKASSA_SHOP_ID && process.env.YOOKASSA_SECRET_KEY)
}

export async function createYooKassaPayment(input: {
  plan: SubscriptionPlan
  userKey: string
  orderId: string
  returnUrl: string
  amount: string
  description: string
}): Promise<YooKassaPayment> {
  const response = await fetch("https://api.yookassa.ru/v3/payments", {
    method: "POST",
    headers: {
      Authorization: authHeader(),
      "Content-Type": "application/json",
      "Idempotence-Key": input.orderId,
    },
    body: JSON.stringify({
      amount: { value: input.amount, currency: "RUB" },
      capture: true,
      confirmation: {
        type: "redirect",
        return_url: input.returnUrl,
      },
      description: input.description,
      metadata: {
        plan: input.plan,
        userKey: input.userKey,
        orderId: input.orderId,
      },
    }),
  })

  if (!response.ok) {
    const details = await response.text()
    throw new Error(`YooKassa create failed: ${response.status} ${details}`)
  }

  return response.json() as Promise<YooKassaPayment>
}

export async function fetchYooKassaPayment(paymentId: string): Promise<YooKassaPayment> {
  const response = await fetch(`https://api.yookassa.ru/v3/payments/${paymentId}`, {
    headers: {
      Authorization: authHeader(),
    },
    cache: "no-store",
  })

  if (!response.ok) {
    const details = await response.text()
    throw new Error(`YooKassa fetch failed: ${response.status} ${details}`)
  }

  return response.json() as Promise<YooKassaPayment>
}

export function getAppBaseUrl() {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000")
  )
}
