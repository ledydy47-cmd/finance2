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
  description?: string
  created_at?: string
  captured_at?: string
  metadata?: {
    plan?: SubscriptionPlan
    userKey?: string
    orderId?: string
    renewal?: string
  }
  payment_method?: {
    id?: string
    saved?: boolean
    type?: string
  }
  confirmation?: {
    type: string
    confirmation_url?: string
  }
}

function getCredentials() {
  const shopId = process.env.YOOKASSA_SHOP_ID ?? process.env.YUKASSA_SHOP_ID
  const secretKey = process.env.YOOKASSA_SECRET_KEY ?? process.env.YUKASSA_SECRET_KEY
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
  const shopId = process.env.YOOKASSA_SHOP_ID ?? process.env.YUKASSA_SHOP_ID
  const secretKey = process.env.YOOKASSA_SECRET_KEY ?? process.env.YUKASSA_SECRET_KEY
  return Boolean(shopId && secretKey)
}

function buildReceipt(input: {
  userKey: string
  amount: string
  description: string
}) {
  const email =
    process.env.YOOKASSA_RECEIPT_EMAIL?.trim() ||
    `receipt+${input.userKey.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 48)}@clients.local`

  const receipt: Record<string, unknown> = {
    customer: { email },
    items: [
      {
        description: input.description.slice(0, 128),
        quantity: "1.00",
        amount: { value: input.amount, currency: "RUB" },
        vat_code: Number(process.env.YOOKASSA_VAT_CODE ?? "1"),
        payment_mode: "full_payment",
        payment_subject: "service",
      },
    ],
  }

  const taxSystemCode = process.env.YOOKASSA_TAX_SYSTEM_CODE?.trim()
  if (taxSystemCode) {
    receipt.tax_system_code = Number(taxSystemCode)
  }

  return receipt
}

const YOOKASSA_FETCH_TIMEOUT_MS = 20_000
const YOOKASSA_FETCH_RETRIES = 3

function isRetryableNetworkError(error: unknown) {
  if (!(error instanceof Error)) return false
  const message = `${error.name} ${error.message}`.toLowerCase()
  const cause =
    error.cause instanceof Error
      ? `${error.cause.name} ${error.cause.message}`.toLowerCase()
      : String(error.cause ?? "").toLowerCase()
  const haystack = `${message} ${cause}`
  return (
    haystack.includes("timeout") ||
    haystack.includes("timed out") ||
    haystack.includes("connect") ||
    haystack.includes("fetch failed") ||
    haystack.includes("econnreset") ||
    haystack.includes("enotfound") ||
    haystack.includes("network")
  )
}

async function yookassaFetch(input: string | URL, init?: RequestInit) {
  let lastError: unknown

  for (let attempt = 1; attempt <= YOOKASSA_FETCH_RETRIES; attempt += 1) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), YOOKASSA_FETCH_TIMEOUT_MS)

    try {
      const response = await fetch(input, {
        ...init,
        signal: controller.signal,
        cache: init?.cache ?? "no-store",
      })
      return response
    } catch (error) {
      lastError = error
      if (attempt >= YOOKASSA_FETCH_RETRIES || !isRetryableNetworkError(error)) {
        throw error
      }
      console.warn(
        `[yookassa] network retry ${attempt}/${YOOKASSA_FETCH_RETRIES}`,
        error instanceof Error ? error.message : error,
      )
      await new Promise((resolve) => setTimeout(resolve, attempt * 400))
    } finally {
      clearTimeout(timer)
    }
  }

  throw lastError instanceof Error ? lastError : new Error("YOOKASSA_FETCH_FAILED")
}

export function parseYooKassaErrorMessage(error: unknown): string | null {
  if (!(error instanceof Error)) return null
  if (isRetryableNetworkError(error) || error.name === "AbortError") {
    return "Платёжный сервис временно недоступен. Подождите минуту и попробуйте ещё раз."
  }
  const match = error.message.match(/YooKassa (?:recurring )?create failed: \d+ (.+)/)
  if (!match?.[1]) return null
  try {
    const body = JSON.parse(match[1]) as { description?: string }
    return body.description ?? null
  } catch {
    return null
  }
}

export async function createYooKassaPayment(input: {
  plan: SubscriptionPlan
  userKey: string
  orderId: string
  returnUrl: string
  amount: string
  description: string
  savePaymentMethod?: boolean
}): Promise<YooKassaPayment> {
  const savePaymentMethod = input.savePaymentMethod ?? true

  const response = await yookassaFetch("https://api.yookassa.ru/v3/payments", {
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
      receipt: buildReceipt({
        userKey: input.userKey,
        amount: input.amount,
        description: input.description,
      }),
      metadata: {
        plan: input.plan,
        userKey: input.userKey,
        orderId: input.orderId,
      },
      ...(savePaymentMethod ? { save_payment_method: true } : {}),
    }),
  })

  if (!response.ok) {
    const details = await response.text()
    throw new Error(`YooKassa create failed: ${response.status} ${details}`)
  }

  return response.json() as Promise<YooKassaPayment>
}

export async function createRecurringYooKassaPayment(input: {
  plan: SubscriptionPlan
  userKey: string
  orderId: string
  amount: string
  description: string
  paymentMethodId: string
}): Promise<YooKassaPayment> {
  const response = await yookassaFetch("https://api.yookassa.ru/v3/payments", {
    method: "POST",
    headers: {
      Authorization: authHeader(),
      "Content-Type": "application/json",
      "Idempotence-Key": input.orderId,
    },
    body: JSON.stringify({
      amount: { value: input.amount, currency: "RUB" },
      capture: true,
      payment_method_id: input.paymentMethodId,
      description: input.description,
      receipt: buildReceipt({
        userKey: input.userKey,
        amount: input.amount,
        description: input.description,
      }),
      metadata: {
        plan: input.plan,
        userKey: input.userKey,
        orderId: input.orderId,
        renewal: "true",
      },
    }),
  })

  if (!response.ok) {
    const details = await response.text()
    throw new Error(`YooKassa recurring create failed: ${response.status} ${details}`)
  }

  return response.json() as Promise<YooKassaPayment>
}

export async function fetchYooKassaPayment(paymentId: string): Promise<YooKassaPayment> {
  const response = await yookassaFetch(`https://api.yookassa.ru/v3/payments/${paymentId}`, {
    headers: {
      Authorization: authHeader(),
    },
  })

  if (!response.ok) {
    const details = await response.text()
    throw new Error(`YooKassa fetch failed: ${response.status} ${details}`)
  }

  return response.json() as Promise<YooKassaPayment>
}

interface YooKassaPaymentListResponse {
  items?: YooKassaPayment[]
  next_cursor?: string
}

export type YooKassaListTimeField = "captured_at" | "created_at"

const LIST_PAYMENTS_MAX_PAGES = 50

export async function listYooKassaPaymentsForPeriod(input: {
  gte: string
  lt: string
  timeField?: YooKassaListTimeField
  status?: YooKassaPayment["status"]
}): Promise<{ items: YooKassaPayment[]; truncated: boolean }> {
  const timeField = input.timeField ?? "captured_at"
  const status = input.status ?? "succeeded"
  const items: YooKassaPayment[] = []
  let cursor: string | undefined
  let truncated = false

  for (let page = 0; page < LIST_PAYMENTS_MAX_PAGES; page += 1) {
    const url = new URL("https://api.yookassa.ru/v3/payments")
    url.searchParams.set(`${timeField}.gte`, input.gte)
    url.searchParams.set(`${timeField}.lt`, input.lt)
    url.searchParams.set("status", status)
    url.searchParams.set("limit", "100")
    if (cursor) url.searchParams.set("cursor", cursor)

    const response = await yookassaFetch(url, {
      headers: { Authorization: authHeader() },
    })

    if (!response.ok) {
      const details = await response.text()
      throw new Error(`YooKassa list failed: ${response.status} ${details}`)
    }

    const payload = (await response.json()) as YooKassaPaymentListResponse
    if (payload.items?.length) items.push(...payload.items)

    cursor = payload.next_cursor
    if (!cursor) break
    if (page === LIST_PAYMENTS_MAX_PAGES - 1) truncated = true
  }

  return { items, truncated }
}

export async function findYooKassaPaymentByOrderId(orderId: string): Promise<YooKassaPayment | null> {
  const since = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString()
  let cursor: string | undefined

  for (let page = 0; page < 5; page += 1) {
    const url = new URL("https://api.yookassa.ru/v3/payments")
    url.searchParams.set("created_at.gte", since)
    url.searchParams.set("limit", "100")
    if (cursor) url.searchParams.set("cursor", cursor)

    const response = await yookassaFetch(url, {
      headers: { Authorization: authHeader() },
    })

    if (!response.ok) {
      const details = await response.text()
      console.error("[yookassa] list payments failed", response.status, details)
      return null
    }

    const payload = (await response.json()) as YooKassaPaymentListResponse
    const match = payload.items?.find((payment) => payment.metadata?.orderId === orderId)
    if (match) return match

    cursor = payload.next_cursor
    if (!cursor) break
  }

  return null
}

const PRODUCTION_APP_URL = "https://finance2-36rh.vercel.app"

export function getAppBaseUrl() {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "")
  if (fromEnv) return fromEnv

  if (process.env.VERCEL_ENV === "production") {
    return PRODUCTION_APP_URL
  }

  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`
  }

  return "http://localhost:3000"
}
