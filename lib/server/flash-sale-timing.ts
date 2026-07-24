import {
  FLASH_SALE_DURATION_MS,
  FLASH_SALE_REMINDER_DELAY_MS,
  FLASH_SALE_REOFFER_4H_MS,
  FLASH_SALE_REOFFER_24H_MS,
} from "@/lib/paywall-experiment"
import {
  getFlashSaleTestSession,
  isFlashSaleTestSession,
} from "@/lib/server/flash-sale-test-mode"

export type FlashSaleReofferKind = "4h" | "24h"

export interface FlashSaleTiming {
  saleDurationMs: number
  reminderDelayMs: number
  reoffer4hMs: number
  reoffer24hMs: number
  isTest: boolean
}

const PRODUCTION_TIMING: FlashSaleTiming = {
  saleDurationMs: FLASH_SALE_DURATION_MS,
  reminderDelayMs: FLASH_SALE_REMINDER_DELAY_MS,
  reoffer4hMs: FLASH_SALE_REOFFER_4H_MS,
  reoffer24hMs: FLASH_SALE_REOFFER_24H_MS,
  isTest: false,
}

export async function getFlashSaleTiming(userKey: string, startedAt: string): Promise<FlashSaleTiming> {
  const test = await getFlashSaleTestSession(userKey)
  if (!isFlashSaleTestSession(test, startedAt)) {
    return PRODUCTION_TIMING
  }

  return {
    saleDurationMs: test.saleDurationMs,
    reminderDelayMs: test.reminderDelayMs,
    reoffer4hMs: test.reoffer4hMs,
    reoffer24hMs: test.reoffer24hMs,
    isTest: true,
  }
}

export function getReofferDelayMs(timing: FlashSaleTiming, offer: FlashSaleReofferKind) {
  return offer === "4h" ? timing.reoffer4hMs : timing.reoffer24hMs
}

export function getReofferScheduleDelayMs(timing: FlashSaleTiming, offer: FlashSaleReofferKind) {
  return timing.saleDurationMs + getReofferDelayMs(timing, offer)
}
