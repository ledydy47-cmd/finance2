export interface VerifiedSubscriptionPayload {
  paymentId: string
  plan: "yearly" | "monthly"
  expiresAt: string
  autoRenew: boolean
  status: string
}

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

export async function verifyPaymentWithRetry(
  paymentId: string,
  options?: { maxAttempts?: number; intervalMs?: number },
): Promise<VerifiedSubscriptionPayload | null> {
  const maxAttempts = options?.maxAttempts ?? 15
  const intervalMs = options?.intervalMs ?? 2000

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      const response = await fetch(
        `/api/payments/verify?paymentId=${encodeURIComponent(paymentId)}`,
      )
      const data = (await response.json()) as {
        active?: boolean
        paymentId?: string
        plan?: "yearly" | "monthly"
        expiresAt?: string
        autoRenew?: boolean
        status?: string
      }

      if (response.ok && data.active && data.paymentId && data.plan && data.expiresAt) {
        return {
          paymentId: data.paymentId,
          plan: data.plan,
          expiresAt: data.expiresAt,
          autoRenew: data.autoRenew ?? true,
          status: data.status ?? "active",
        }
      }
    } catch {
      // retry
    }

    if (attempt < maxAttempts - 1) {
      await sleep(intervalMs)
    }
  }

  return null
}
