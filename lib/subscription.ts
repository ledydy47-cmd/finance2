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
    text: "Я года три не могла начать копить, деньги просто утекали. За 2 месяца в приложении отложила на отпуск 40к, и я до сих пор в шоке 😳 Впервые вижу, куда уходит зарплата",
    author: "Маша Л.",
  },
  {
    text: "Наконец-то не таблица в экселе, которую я бросала через неделю 🥲 Тут реально красиво и не бесит открывать. Плюс цель с фоткой моей мечты — это гениально, мотивирует",
    author: "Катя В.",
  },
  {
    text: "Планировщик бюджета — топ. Ввожу зарплату, распределяю, и сразу видно сколько останется на мечту. Перестала спускать всё на маркетплейсах, ну почти 😅",
    author: "Алина С.",
  },
  {
    text: "Пользуюсь месяц. Впервые дожила до конца месяца с деньгами, а не в минусе. Аналитика открыла глаза, оказывается на кафе у меня уходило больше чем на продукты 💀",
    author: "Даша М.",
  },
  {
    text: "Скачала ради интереса, осталась насовсем. Удобно, мило, и главное реально помогает не тратить бездумно. Подруге уже посоветовала 💗",
    author: "Аня К.",
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
