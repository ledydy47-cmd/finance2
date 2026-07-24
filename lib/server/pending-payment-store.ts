import { kvRestDel, kvRestGet, kvRestGetJson, kvRestSet } from "@/lib/server/kv-rest"
import type { SubscriptionPlan } from "@/lib/subscription"

const pendingKey = (userKey: string) => `kopilka:pending-payment:${userKey}`
const orderKey = (orderId: string) => `kopilka:pending-order:${orderId}`
const paymentOwnerKey = (paymentId: string) => `kopilka:payment-owner:${paymentId}`

export interface PendingPaymentRecord {
  paymentId: string
  userKey: string
  plan: SubscriptionPlan
  orderId: string
  createdAt: string
}

export async function savePendingPayment(record: PendingPaymentRecord) {
  await kvRestSet(pendingKey(record.userKey), JSON.stringify(record))
  await kvRestSet(orderKey(record.orderId), JSON.stringify(record))
  await kvRestSet(paymentOwnerKey(record.paymentId), record.userKey)
  return record
}

export async function getPendingPaymentByOrderId(orderId: string) {
  return kvRestGetJson<PendingPaymentRecord | null>(orderKey(orderId), null)
}

export async function getPendingPayment(userKey: string) {
  return kvRestGetJson<PendingPaymentRecord | null>(pendingKey(userKey), null)
}

export async function getPendingPaymentOwner(paymentId: string) {
  return kvRestGet(paymentOwnerKey(paymentId))
}

export async function clearPendingPayment(userKey: string, paymentId?: string) {
  const pending = await getPendingPayment(userKey)
  await kvRestDel(pendingKey(userKey))

  const resolvedPaymentId = paymentId ?? pending?.paymentId
  if (resolvedPaymentId) {
    await kvRestDel(paymentOwnerKey(resolvedPaymentId))
  }
  if (pending?.orderId) {
    await kvRestDel(orderKey(pending.orderId))
  }
}
