export type SubscriptionPlan = "yearly" | "monthly"

export const PLAN_CONFIG: Record<
  SubscriptionPlan,
  { amount: string; description: string; durationDays: number; label: string }
> = {
  yearly: {
    amount: "1490.00",
    description: "Копилка — годовая подписка",
    durationDays: 365,
    label: "Годовая",
  },
  monthly: {
    amount: "299.00",
    description: "Копилка — месячная подписка",
    durationDays: 30,
    label: "Месячная",
  },
}

export const PAYWALL_TESTIMONIALS = [
  {
    text: "Я года три не могла начать копить, деньги просто утекали. За 2 месяца отложила на отпуск 40к — до сих пор в шоке 😳",
    author: "Маша Л.",
  },
  {
    text: "Наконец-то не таблица в экселе, которую бросала через неделю 🥲 Цель с фоткой мечты — гениально, мотивирует",
    author: "Катя В.",
  },
  {
    text: "Планировщик бюджета — топ. Сразу видно, сколько останется на мечту. Перестала спускать всё на маркетплейсах 😅",
    author: "Алина С.",
  },
] as const

export function computeSubscriptionExpiry(plan: SubscriptionPlan, from = new Date()) {
  const expires = new Date(from)
  expires.setDate(expires.getDate() + PLAN_CONFIG[plan].durationDays)
  return expires.toISOString()
}

export function isSubscriptionActive(expiresAt: string | null | undefined) {
  if (!expiresAt) return false
  return new Date(expiresAt).getTime() > Date.now()
}

export const PENDING_PAYMENT_STORAGE_KEY = "kopilka-pending-payment-id"
