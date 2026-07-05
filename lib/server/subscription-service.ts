import { randomUUID } from "node:crypto"
import {
  computeSubscriptionExpiry,
  isSubscriptionActive,
  PLAN_CONFIG,
  type SubscriptionPlan,
} from "@/lib/subscription"
import {
  getSubscriptionByUserKey,
  parseTelegramUserId,
  upsertSubscription,
} from "@/lib/server/subscription-store"
import { findTelegramUserByUsername } from "@/lib/server/telegram-users"
import type { SubscriptionRecord, SubscriptionStatus } from "@/lib/server/subscription-types"
import { formatPeriodEnd, sendTelegramNotification } from "@/lib/server/telegram-notify"
import type { YooKassaPayment } from "@/lib/yookassa/server"
import { createRecurringYooKassaPayment, fetchYooKassaPayment } from "@/lib/yookassa/server"

function nowIso() {
  return new Date().toISOString()
}

export function extendPeriodEnd(plan: SubscriptionPlan, fromIso: string) {
  return computeSubscriptionExpiry(plan, new Date(fromIso))
}

export async function activateSubscriptionFromPayment(payment: YooKassaPayment) {
  if (payment.status !== "succeeded" || !payment.paid) return null

  const plan = payment.metadata?.plan
  const userKey = payment.metadata?.userKey?.trim()
  if ((plan !== "yearly" && plan !== "monthly") || !userKey) return null

  const existing = await getSubscriptionByUserKey(userKey)
  const baseDate =
    existing && isSubscriptionActive(existing.currentPeriodEnd)
      ? existing.currentPeriodEnd
      : nowIso()

  const currentPeriodEnd = extendPeriodEnd(plan, baseDate)
  const paymentMethodId =
    payment.payment_method?.id ?? existing?.paymentMethodId ?? null

  const record: SubscriptionRecord = {
    userKey,
    telegramUserId: parseTelegramUserId(userKey),
    paymentMethodId,
    subscriptionType: plan,
    currentPeriodEnd,
    autoRenew: true,
    status: "active",
    renewalAttempts: 0,
    lastPaymentId: payment.id,
    updatedAt: nowIso(),
  }

  await upsertSubscription(record)

  return {
    paymentId: payment.id,
    userKey,
    plan,
    currentPeriodEnd,
    autoRenew: true,
    status: record.status,
    paymentMethodId,
  }
}

export async function cancelAutoRenewal(userKey: string) {
  const existing = await getSubscriptionByUserKey(userKey)
  if (!existing || !isSubscriptionActive(existing.currentPeriodEnd)) {
    return { ok: false as const, error: "NO_ACTIVE_SUBSCRIPTION" as const }
  }

  const updated: SubscriptionRecord = {
    ...existing,
    autoRenew: false,
    status: existing.status === "active" ? "canceled" : existing.status,
    updatedAt: nowIso(),
  }

  await upsertSubscription(updated)

  await sendTelegramNotification({
    telegramUserId: updated.telegramUserId,
    text: `Автопродление подписки «Мани.точка» отключено. Доступ сохранится до ${formatPeriodEnd(updated.currentPeriodEnd)}.`,
  })

  return {
    ok: true as const,
    currentPeriodEnd: updated.currentPeriodEnd,
    autoRenew: updated.autoRenew,
  }
}

export async function resumeAutoRenewal(userKey: string) {
  const existing = await getSubscriptionByUserKey(userKey)
  if (!existing || !isSubscriptionActive(existing.currentPeriodEnd)) {
    return { ok: false as const, error: "NO_ACTIVE_SUBSCRIPTION" as const }
  }

  if (!existing.paymentMethodId) {
    return { ok: false as const, error: "NO_PAYMENT_METHOD" as const }
  }

  const updated: SubscriptionRecord = {
    ...existing,
    autoRenew: true,
    status: "active",
    renewalAttempts: 0,
    updatedAt: nowIso(),
  }

  await upsertSubscription(updated)

  await sendTelegramNotification({
    telegramUserId: updated.telegramUserId,
    text: `Автопродление подписки «Мани.точка» снова включено. Следующее списание после ${formatPeriodEnd(updated.currentPeriodEnd)}.`,
  })

  return {
    ok: true as const,
    currentPeriodEnd: updated.currentPeriodEnd,
    autoRenew: updated.autoRenew,
  }
}

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

export async function processDueRenewals(today = new Date()) {
  const { listSubscriptions } = await import("@/lib/server/subscription-store")
  const records = await listSubscriptions()
  const results: Array<{ userKey: string; action: string }> = []

  for (const record of records) {
    const periodEnd = new Date(record.currentPeriodEnd)
    if (!isSameDay(periodEnd, today)) continue

    if (record.autoRenew && record.paymentMethodId) {
      try {
        const plan = PLAN_CONFIG[record.subscriptionType]
        const payment = await createRecurringYooKassaPayment({
          userKey: record.userKey,
          orderId: randomUUID(),
          amount: plan.amount,
          description: `${plan.description} — автопродление`,
          paymentMethodId: record.paymentMethodId,
          plan: record.subscriptionType,
        })

        if (payment.status === "succeeded" && payment.paid) {
          await activateSubscriptionFromPayment(payment)
          results.push({ userKey: record.userKey, action: "renewed" })
          continue
        }

        const attempts = record.renewalAttempts + 1
        const nextStatus: SubscriptionStatus = attempts >= 2 ? "expired" : "past_due"
        await upsertSubscription({
          ...record,
          renewalAttempts: attempts,
          autoRenew: attempts >= 2 ? false : record.autoRenew,
          status: nextStatus,
          updatedAt: nowIso(),
        })

        await sendTelegramNotification({
          telegramUserId: record.telegramUserId,
          text:
            attempts >= 2
              ? "Не удалось продлить подписку «Мани.точка». Доступ к премиум-функциям отключён."
              : "Не удалось списать оплату за продление подписки «Мани.точка». Повторим попытку позже.",
        })

        results.push({ userKey: record.userKey, action: nextStatus })
      } catch (error) {
        console.error("[subscription-renewals]", record.userKey, error)
        results.push({ userKey: record.userKey, action: "error" })
      }
      continue
    }

    if (!record.autoRenew) {
      await upsertSubscription({
        ...record,
        status: "expired",
        updatedAt: nowIso(),
      })

      await sendTelegramNotification({
        telegramUserId: record.telegramUserId,
        text: "Срок подписки «Мани.точка» истёк. Вы перешли на бесплатный тариф.",
      })

      results.push({ userKey: record.userKey, action: "expired" })
    }
  }

  return results
}

export async function getServerSubscriptionStatus(userKey: string) {
  const record = await getSubscriptionByUserKey(userKey)
  if (!record) return null

  const active = isSubscriptionActive(record.currentPeriodEnd) && record.status !== "expired"

  return {
    subscriptionType: record.subscriptionType,
    currentPeriodEnd: record.currentPeriodEnd,
    autoRenew: record.autoRenew,
    status: record.status,
    active,
    lastPaymentId: record.lastPaymentId,
  }
}

export async function grantManualSubscription(input: {
  telegramUserId: number
  plan?: SubscriptionPlan
}) {
  const userKey = `tg-${input.telegramUserId}`
  const plan = input.plan ?? "yearly"
  const paymentId = `manual-${randomUUID()}`
  const currentPeriodEnd = computeSubscriptionExpiry(plan)

  const record: SubscriptionRecord = {
    userKey,
    telegramUserId: input.telegramUserId,
    paymentMethodId: null,
    subscriptionType: plan,
    currentPeriodEnd,
    autoRenew: false,
    status: "active",
    renewalAttempts: 0,
    lastPaymentId: paymentId,
    updatedAt: nowIso(),
  }

  await upsertSubscription(record)

  return {
    userKey,
    plan,
    paymentId,
    currentPeriodEnd,
    autoRenew: false,
    status: record.status,
    active: true,
  }
}

export async function resolveTelegramUserId(username: string): Promise<number | null> {
  const registered = await findTelegramUserByUsername(username)
  if (registered) return registered.telegramUserId

  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) return null

  const handle = username.replace(/^@/, "")
  const response = await fetch(
    `https://api.telegram.org/bot${token}/getChat?chat_id=${encodeURIComponent(`@${handle}`)}`,
    { cache: "no-store" },
  )
  if (!response.ok) return null

  const payload = (await response.json()) as { ok?: boolean; result?: { id?: number } }
  return payload.ok && payload.result?.id ? payload.result.id : null
}

export async function verifyPaymentById(paymentId: string) {
  const payment = await fetchYooKassaPayment(paymentId)
  return activateSubscriptionFromPayment(payment)
}
