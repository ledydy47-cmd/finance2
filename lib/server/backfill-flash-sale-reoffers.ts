import type { FlashSaleReofferType } from "@/lib/server/flash-sale-cron-service"
import { registerFlashSaleLifecycle } from "@/lib/server/flash-sale-lifecycle-store"
import {
  ensureFlashSaleReoffer,
} from "@/lib/server/ensure-flash-sale-reoffer"
import { getFlashSaleStartedAt, setFlashSaleStartedAt } from "@/lib/server/flash-sale-store"
import { getServerSubscriptionStatus } from "@/lib/server/subscription-service"
import { readAnalyticsStore } from "@/lib/server/user-analytics-store"
import { parseTelegramUserId } from "@/lib/server/subscription-store"

type EnsureResult = Awaited<ReturnType<typeof ensureFlashSaleReoffer>>

export async function backfillFlashSaleReoffers(input?: {
  offset?: number
  limit?: number
  offers?: FlashSaleReofferType[]
}) {
  const offset = Math.max(0, input?.offset ?? 0)
  const limit = input?.limit && input.limit > 0 ? Math.floor(input.limit) : 40
  const offers = input?.offers?.length ? input.offers : (["4h", "24h"] as const)

  const allCandidates = Object.values((await readAnalyticsStore()).users).filter((user) => {
    if (!user.paywallShownAt) return false
    if (user.subscriptionPlan !== "none") return false
    if (!user.telegramUserId && !parseTelegramUserId(user.userKey)) return false
    return true
  })

  const candidates = allCandidates.slice(offset, offset + limit)
  const results: Array<{
    userKey: string
    offer: FlashSaleReofferType
    result: EnsureResult
  }> = []

  const summary = {
    delivered4h: 0,
    delivered24h: 0,
    scheduled4h: 0,
    scheduled24h: 0,
    alreadySent4h: 0,
    alreadySent24h: 0,
    skipped: 0,
    failed: 0,
  }

  for (const user of candidates) {
    const subscription = await getServerSubscriptionStatus(user.userKey)
    if (subscription?.active) {
      summary.skipped += offers.length
      continue
    }

    let startedAt = await getFlashSaleStartedAt(user.userKey)
    if (!startedAt && user.paywallShownAt) {
      startedAt = user.paywallShownAt
      await setFlashSaleStartedAt(user.userKey, startedAt)
      await registerFlashSaleLifecycle(user.userKey, startedAt)
    }

    if (!startedAt) {
      summary.failed += offers.length
      continue
    }

    for (const offer of offers) {
      const result = await ensureFlashSaleReoffer({ userKey: user.userKey, offer })
      results.push({ userKey: user.userKey, offer, result })

      if ("error" in result && result.error) {
        summary.failed += 1
        continue
      }

      if (result.action === "DELIVERED") {
        if (offer === "4h") summary.delivered4h += 1
        else summary.delivered24h += 1
      } else if (result.action === "SCHEDULED") {
        if (offer === "4h") summary.scheduled4h += 1
        else summary.scheduled24h += 1
      } else if (result.action === "ALREADY_SENT") {
        if (offer === "4h") summary.alreadySent4h += 1
        else summary.alreadySent24h += 1
      } else {
        summary.skipped += 1
      }
    }
  }

  return {
    total: allCandidates.length,
    batchOffset: offset,
    batchLimit: limit,
    batchSize: candidates.length,
    offers,
    summary,
    results,
  }
}
