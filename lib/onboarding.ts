export const ONBOARDING_TOTAL_STEPS = 9

export const SAVING_MOTIVATION_OPTIONS = [
  { id: "security", label: "Финансовая безопасность", emoji: "🛡️" },
  { id: "goals", label: "Конкретные цели", emoji: "🎯" },
  { id: "freedom", label: "Свобода", emoji: "🕊️" },
  { id: "calm", label: "Спокойствие", emoji: "🌸" },
] as const

export const MONEY_PROBLEM_OPTIONS = [
  { id: "impulse", label: "Импульсивные покупки", emoji: "🛍️" },
  { id: "tracking", label: "Не знаю, куда уходят", emoji: "🔍" },
  { id: "debt", label: "Долги", emoji: "💳" },
  { id: "regular", label: "Копить регулярно", emoji: "🐷" },
] as const

export const FINANCE_FEELING_OPTIONS = [
  { id: "anxiety", label: "Тревогу", emoji: "😰" },
  { id: "indifference", label: "Безразличие", emoji: "😶" },
  { id: "motivation", label: "Мотивацию", emoji: "✨" },
  { id: "confusion", label: "Растерянность", emoji: "🌀" },
] as const

export const SAVINGS_PRESETS = [3000, 5000, 10000, 15000, 20000] as const

export const CURRENCY_OPTIONS = [{ id: "RUB" as const, label: "₽ Рубль" }]

export interface OnboardingDraft {
  name: string
  age: number
  savingMotivation: string
  moneyProblem: string
  financeFeeling: string
  currency: "RUB"
  monthlySavings: number | null
  customSavings: string
}

export function createOnboardingDraft(userName = ""): OnboardingDraft {
  return {
    name: userName,
    age: 25,
    savingMotivation: "",
    moneyProblem: "",
    financeFeeling: "",
    currency: "RUB",
    monthlySavings: null,
    customSavings: "",
  }
}
