export const APP_CURRENCIES = ["RUB", "KZT", "BYN", "USD", "EUR"] as const

export type AppCurrency = (typeof APP_CURRENCIES)[number]

export const DEFAULT_CURRENCY: AppCurrency = "RUB"

export const CURRENCY_OPTIONS: ReadonlyArray<{
  id: AppCurrency
  label: string
  locale: string
}> = [
  { id: "RUB", label: "₽ Рубль", locale: "ru-RU" },
  { id: "KZT", label: "₸ Тенге", locale: "kk-KZ" },
  { id: "BYN", label: "Br Белорусский рубль", locale: "be-BY" },
  { id: "USD", label: "$ Доллар", locale: "en-US" },
  { id: "EUR", label: "€ Евро", locale: "de-DE" },
]

const SAVINGS_PRESETS: Record<AppCurrency, readonly number[]> = {
  RUB: [3_000, 5_000, 10_000, 15_000, 20_000],
  KZT: [15_000, 25_000, 50_000, 75_000, 100_000],
  BYN: [100, 200, 400, 600, 800],
  USD: [50, 100, 200, 300, 400],
  EUR: [50, 100, 200, 300, 400],
}

const CURRENCY_LOCALE = Object.fromEntries(
  CURRENCY_OPTIONS.map((option) => [option.id, option.locale]),
) as Record<AppCurrency, string>

export function isAppCurrency(value: unknown): value is AppCurrency {
  return typeof value === "string" && (APP_CURRENCIES as readonly string[]).includes(value)
}

export function normalizeAppCurrency(value: unknown): AppCurrency {
  return isAppCurrency(value) ? value : DEFAULT_CURRENCY
}

export function getCurrencyLabel(currency: AppCurrency) {
  return CURRENCY_OPTIONS.find((option) => option.id === currency)?.label ?? currency
}

export function getCurrencyAmountPlaceholder(currency: AppCurrency) {
  const placeholders: Record<AppCurrency, string> = {
    RUB: "Целевая сумма, ₽",
    KZT: "Целевая сумма, ₸",
    BYN: "Целевая сумма, Br",
    USD: "Целевая сумма, $",
    EUR: "Целевая сумма, €",
  }
  return placeholders[currency]
}

export function getSavingsPresets(currency: AppCurrency) {
  return SAVINGS_PRESETS[currency]
}

export function formatMoney(value: number, currency: AppCurrency = DEFAULT_CURRENCY) {
  const locale = CURRENCY_LOCALE[currency] ?? "ru-RU"
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(Math.round(value))
}

export function getPaywallPaymentNote(currency: AppCurrency) {
  if (currency === "RUB") {
    return "Оплата проходит в рублях. Подходят карты РФ, «Мир» (в т.ч. KZ/BY), Belkart и ЮMoney."
  }

  const label = getCurrencyLabel(currency)
  return `Суммы в приложении — в ${label.split(" ").slice(1).join(" ") || "выбранной валюте"}. Оплата подписки проходит в рублях (1490 ₽ / 299 ₽). Подходят карты «Мир» (KZ/BY), Belkart, ЮMoney и карты российских банков.`
}
