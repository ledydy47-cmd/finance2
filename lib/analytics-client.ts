export type ClientAnalyticsEvent =
  | "app_opened"
  | "onboarding_started"
  | "onboarding_completed"
  | "walkthrough_completed"
  | "paywall_shown"

export async function trackClientAnalytics(input: {
  event: ClientAnalyticsEvent
  userKey: string
  telegramUserId?: number | null
  telegramUsername?: string | null
  userName?: string | null
  age?: number | null
}) {
  try {
    await fetch("/api/analytics/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    })
  } catch {
    // non-blocking
  }
}
