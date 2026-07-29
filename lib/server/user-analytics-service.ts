import { randomUUID } from "node:crypto"
import { parseTelegramUserId } from "@/lib/server/subscription-store"
import { getSubscriptionByUserKey } from "@/lib/server/subscription-store"
import { isSubscriptionActive } from "@/lib/subscription"
import { sendTelegramNotification } from "@/lib/server/telegram-notify"
import {
  getUserAnalyticsRecord,
  readAnalyticsStore,
  readCampaignStore,
  updateUserAnalyticsRecord,
  writeCampaignStore,
} from "@/lib/server/user-analytics-store"
import type {
  AnalyticsEventType,
  MessageCampaign,
  MessageCampaignFilter,
  UserAnalyticsRecord,
  UserSubscriptionFilter,
} from "@/lib/server/user-analytics-types"
import { planToFilter } from "@/lib/server/user-analytics-types"

function nowIso() {
  return new Date().toISOString()
}

function createEmptyUser(input: {
  userKey: string
  telegramUserId?: number | null
  telegramUsername?: string | null
  userName?: string | null
  age?: number | null
}): UserAnalyticsRecord {
  const at = nowIso()
  return {
    userKey: input.userKey,
    telegramUserId: input.telegramUserId ?? parseTelegramUserId(input.userKey),
    telegramUsername: input.telegramUsername ?? null,
    userName: input.userName ?? null,
    age: input.age ?? null,
    appOpenedAt: null,
    onboardingStartedAt: null,
    onboardingCompletedAt: null,
    walkthroughCompletedAt: null,
    homeWalkthroughCompleted: null,
    firstExpenseAdded: null,
    paywallShownAt: null,
    subscribedMonthlyAt: null,
    subscribedYearlyAt: null,
    autoRenewCanceledAt: null,
    subscriptionPlan: "none",
    lastVisitAt: at,
    events: [],
  }
}

function shouldSkipDuplicateEvent(
  record: UserAnalyticsRecord,
  type: AnalyticsEventType,
  at: string,
) {
  const last = record.events.at(-1)
  if (!last || last.type !== type) return false

  const gapMs = new Date(at).getTime() - new Date(last.at).getTime()
  return gapMs >= 0 && gapMs < 30_000
}

function applyEvent(record: UserAnalyticsRecord, type: AnalyticsEventType, at: string) {
  if (shouldSkipDuplicateEvent(record, type, at)) return

  record.events.push({ type, at })
  if (record.events.length > 25) {
    record.events = record.events.slice(-25)
  }

  switch (type) {
    case "app_opened":
      record.appOpenedAt ??= at
      break
    case "onboarding_started":
      record.onboardingStartedAt ??= at
      break
    case "onboarding_completed":
      record.onboardingCompletedAt ??= at
      break
    case "walkthrough_completed":
      record.walkthroughCompletedAt ??= at
      break
    case "paywall_shown":
      record.paywallShownAt ??= at
      break
    case "subscription_paid_monthly":
      record.subscribedMonthlyAt ??= at
      record.subscriptionPlan = "monthly"
      break
    case "subscription_paid_yearly":
      record.subscribedYearlyAt ??= at
      record.subscriptionPlan = "yearly"
      break
    case "auto_renew_canceled":
      record.autoRenewCanceledAt ??= at
      break
  }
}

export async function recordAnalyticsEvent(input: {
  event: AnalyticsEventType
  userKey: string
  telegramUserId?: number | null
  telegramUsername?: string | null
  userName?: string | null
  age?: number | null
}) {
  const at = nowIso()

  return updateUserAnalyticsRecord(input.userKey, (existing) => {
    const record = existing ?? createEmptyUser(input)

    if (input.telegramUserId) record.telegramUserId = input.telegramUserId
    if (input.telegramUsername) record.telegramUsername = input.telegramUsername
    if (input.userName) record.userName = input.userName
    if (input.age != null) record.age = input.age
    record.lastVisitAt = at

    applyEvent(record, input.event, at)
    return record
  })
}

export async function ensureAnalyticsUser(input: {
  userKey: string
  telegramUserId?: number | null
  telegramUsername?: string | null
  userName?: string | null
  age?: number | null
}) {
  const at = nowIso()

  return updateUserAnalyticsRecord(input.userKey, (existing) => {
    if (existing) {
      if (input.telegramUserId) existing.telegramUserId = input.telegramUserId
      if (input.telegramUsername) existing.telegramUsername = input.telegramUsername
      if (input.userName) existing.userName = input.userName
      if (input.age != null) existing.age = input.age
      existing.lastVisitAt = at
      return existing
    }

    const created = createEmptyUser(input)
    created.appOpenedAt = at
    return created
  })
}

export async function syncUserSubscriptionPlan(userKey: string) {
  const subscription = await getSubscriptionByUserKey(userKey)
  if (!subscription || !isSubscriptionActive(subscription.currentPeriodEnd)) return

  const existing = await getUserAnalyticsRecord(userKey)
  if (!existing) return

  await updateUserAnalyticsRecord(userKey, (record) => {
    if (!record) return existing
    record.subscriptionPlan = planToFilter(subscription.subscriptionType)
    if (subscription.subscriptionType === "monthly" && !record.subscribedMonthlyAt) {
      record.subscribedMonthlyAt = subscription.updatedAt
    }
    if (subscription.subscriptionType === "yearly" && !record.subscribedYearlyAt) {
      record.subscribedYearlyAt = subscription.updatedAt
    }
    return record
  })
}

export function hasCompletedWalkthrough(user: UserAnalyticsRecord) {
  if (user.homeWalkthroughCompleted === true) return true
  if (user.homeWalkthroughCompleted === false) return false
  return Boolean(user.walkthroughCompletedAt)
}

export function hasAddedFirstExpense(user: UserAnalyticsRecord) {
  return user.firstExpenseAdded === true
}

const ANALYTICS_TIMEZONE = "Europe/Moscow"

export function formatDateInAnalyticsTimezone(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: ANALYTICS_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date)
}

export function countNewUsersOnDate(users: UserAnalyticsRecord[], dateYmd: string) {
  return users.filter(
    (user) => user.appOpenedAt && formatDateInAnalyticsTimezone(new Date(user.appOpenedAt)) === dateYmd,
  ).length
}

export async function syncUserAppState(input: {
  userKey: string
  homeWalkthroughCompleted?: boolean
  onboardingCompleted?: boolean
  firstExpenseAdded?: boolean
  paywallShown?: boolean
  userName?: string | null
  age?: number | null
}) {
  const at = nowIso()

  return updateUserAnalyticsRecord(input.userKey, (existing) => {
    const record =
      existing ??
      createEmptyUser({ userKey: input.userKey, userName: input.userName, age: input.age })

    if (input.userName) record.userName = input.userName
    if (input.age != null) record.age = input.age
    record.lastVisitAt = at

    if (input.onboardingCompleted === true && !record.onboardingCompletedAt) {
      applyEvent(record, "onboarding_completed", at)
    }

    if (input.homeWalkthroughCompleted != null) {
      record.homeWalkthroughCompleted = input.homeWalkthroughCompleted

      if (input.homeWalkthroughCompleted && !record.walkthroughCompletedAt) {
        applyEvent(record, "walkthrough_completed", at)
      }
    }

    if (input.firstExpenseAdded != null) {
      record.firstExpenseAdded = input.firstExpenseAdded
    }

    if (input.paywallShown === true && !record.paywallShownAt) {
      applyEvent(record, "paywall_shown", at)
    }

    return record
  })
}

export async function getAnalyticsSummary(dateYmd?: string | null) {
  const users = Object.values((await readAnalyticsStore()).users)
  const selectedDate = dateYmd ?? formatDateInAnalyticsTimezone(new Date())

  return {
    totalUsers: users.length,
    totalAppOpened: users.filter((u) => u.appOpenedAt).length,
    totalOnboardingStarted: users.filter((u) => u.onboardingStartedAt).length,
    totalOnboardingCompleted: users.filter((u) => u.onboardingCompletedAt).length,
    totalWalkthroughCompleted: users.filter((u) => hasCompletedWalkthrough(u)).length,
    totalFirstExpenseAdded: users.filter((u) => hasAddedFirstExpense(u)).length,
    totalPaywallShown: users.filter((u) => u.paywallShownAt).length,
    totalSubscribedMonthly: users.filter((u) => u.subscribedMonthlyAt).length,
    totalSubscribedYearly: users.filter((u) => u.subscribedYearlyAt).length,
    totalAutoRenewCanceled: users.filter((u) => u.autoRenewCanceledAt).length,
    newUsersOnDate: countNewUsersOnDate(users, selectedDate),
    selectedDate,
    analyticsTimezone: ANALYTICS_TIMEZONE,
  }
}

function matchesFilter(user: UserAnalyticsRecord, filter: UserSubscriptionFilter) {
  return user.subscriptionPlan === filter
}

function matchesCampaignFilter(user: UserAnalyticsRecord, filter: MessageCampaignFilter) {
  if (filter === "all") return true
  if (filter === "paywall_no_pay") {
    return Boolean(user.paywallShownAt) && user.subscriptionPlan === "none"
  }
  if (filter === "no_subscription") {
    return user.subscriptionPlan === "none"
  }
  return user.subscriptionPlan === filter
}

function toAdminListUser(user: UserAnalyticsRecord): UserAnalyticsRecord {
  return {
    ...user,
    events: user.events.slice(-15),
  }
}

export async function listAnalyticsUsers(filter?: UserSubscriptionFilter) {
  const users = Object.values((await readAnalyticsStore()).users).sort(
    (a, b) => new Date(b.lastVisitAt).getTime() - new Date(a.lastVisitAt).getTime(),
  )
  const mapped = users.map(toAdminListUser)
  if (!filter) return mapped
  return mapped.filter((user) => matchesFilter(user, filter))
}

export function formatMessageWithName(userName: string | null, message: string) {
  const name = userName?.trim() || "Привет"
  const body = message.trim()
  return `${name}, ${body}`
}

export async function sendMessageToUser(input: {
  userKey: string
  message: string
}) {
  const store = await readAnalyticsStore()
  const user = store.users[input.userKey]
  const telegramUserId = user?.telegramUserId ?? parseTelegramUserId(input.userKey)
  if (!telegramUserId) {
    return { ok: false as const, error: "NO_TELEGRAM" as const }
  }

  const text = formatMessageWithName(user?.userName ?? null, input.message)
  const result = await sendTelegramNotification({
    telegramUserId,
    text,
  })

  return result.ok
    ? { ok: true as const, text }
    : { ok: false as const, error: "SEND_FAILED" as const }
}

export async function sendMessageToFilteredUsers(input: {
  filter: MessageCampaignFilter
  message: string
}) {
  const users = await listAnalyticsUsers()
  const targets = users.filter((user) => matchesCampaignFilter(user, input.filter))
  const results: Array<{ userKey: string; ok: boolean }> = []

  for (const user of targets) {
    const result = await sendMessageToUser({ userKey: user.userKey, message: input.message })
    results.push({ userKey: user.userKey, ok: result.ok })
  }

  return { sent: results.filter((r) => r.ok).length, total: targets.length, results }
}

export async function createMessageCampaign(input: {
  name: string
  message: string
  type: MessageCampaign["type"]
  filter: MessageCampaignFilter
  scheduledAt?: string | null
  delayHours?: number | null
  targetUserKey?: string | null
}) {
  const campaign: MessageCampaign = {
    id: randomUUID(),
    name: input.name.trim(),
    message: input.message.trim(),
    type: input.type,
    filter: input.filter,
    scheduledAt: input.scheduledAt ?? null,
    delayHours: input.delayHours ?? null,
    targetUserKey: input.targetUserKey ?? null,
    triggerEvent: input.type === "delayed_filter" ? "paywall_shown" : null,
    status: "active",
    sentToUserKeys: [],
    createdAt: nowIso(),
    lastRunAt: null,
  }

  const store = await readCampaignStore()
  store.campaigns[campaign.id] = campaign
  await writeCampaignStore(store)
  return campaign
}

export async function listMessageCampaigns() {
  const store = await readCampaignStore()
  return Object.values(store.campaigns).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  )
}

export async function processScheduledCampaigns(now = new Date()) {
  const store = await readCampaignStore()
  const analytics = await readAnalyticsStore()
  const users = Object.values(analytics.users)
  let sentTotal = 0

  for (const campaign of Object.values(store.campaigns)) {
    if (campaign.status !== "active") continue

    if (campaign.type === "scheduled_broadcast" && campaign.scheduledAt) {
      if (new Date(campaign.scheduledAt).getTime() > now.getTime()) continue

      for (const user of users) {
        if (!matchesCampaignFilter(user, campaign.filter)) continue
        if (campaign.sentToUserKeys.includes(user.userKey)) continue
        const result = await sendMessageToUser({ userKey: user.userKey, message: campaign.message })
        if (result.ok) {
          campaign.sentToUserKeys.push(user.userKey)
          sentTotal += 1
        }
      }
      campaign.status = "completed"
      campaign.lastRunAt = nowIso()
      continue
    }

    if (
      campaign.type === "scheduled_user" &&
      campaign.targetUserKey &&
      campaign.scheduledAt
    ) {
      if (new Date(campaign.scheduledAt).getTime() > now.getTime()) continue
      if (!campaign.sentToUserKeys.includes(campaign.targetUserKey)) {
        const result = await sendMessageToUser({
          userKey: campaign.targetUserKey,
          message: campaign.message,
        })
        if (result.ok) {
          campaign.sentToUserKeys.push(campaign.targetUserKey)
          sentTotal += 1
        }
      }
      campaign.status = "completed"
      campaign.lastRunAt = nowIso()
      continue
    }

    if (campaign.type === "delayed_filter" && campaign.delayHours != null) {
      const delayMs = campaign.delayHours * 60 * 60 * 1000
      for (const user of users) {
        if (!matchesCampaignFilter(user, campaign.filter)) continue
        if (!user.paywallShownAt) continue
        if (campaign.sentToUserKeys.includes(user.userKey)) continue
        const dueAt = new Date(user.paywallShownAt).getTime() + delayMs
        if (dueAt > now.getTime()) continue

        const result = await sendMessageToUser({ userKey: user.userKey, message: campaign.message })
        if (result.ok) {
          campaign.sentToUserKeys.push(user.userKey)
          sentTotal += 1
        }
      }
      campaign.lastRunAt = nowIso()
    }
  }

  await writeCampaignStore(store)
  return { sentTotal }
}

export type { UserAnalyticsRecord }
