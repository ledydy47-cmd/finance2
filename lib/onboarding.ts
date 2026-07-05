export const ONBOARDING_TOTAL_STEPS = 14

export const TRACKING_WEEK_ITEMS = [
  {
    week: 1,
    label: "Неделя 1",
    text: "Записывай каждую трату и замечай привычки",
    emoji: "✏️",
    themeId: "pink" as const,
    progress: 25,
  },
  {
    week: 2,
    label: "Неделя 2",
    text: "Находи, на чём можно сэкономить",
    emoji: "🔍",
    themeId: "mint" as const,
    progress: 50,
  },
  {
    week: 3,
    label: "Неделя 3",
    text: "Принимай решения на основе реальных данных",
    emoji: "🧠",
    themeId: "lavender" as const,
    progress: 75,
  },
  {
    week: 4,
    label: "Неделя 4",
    text: "Экономь без лишних усилий",
    emoji: "✨",
    themeId: "blue" as const,
    progress: 100,
  },
] as const

export const TRACKING_STATS = [
  { value: "23%", label: "средняя экономия" },
  { value: "5 мин", label: "в день" },
  { value: "30", label: "дней" },
] as const

export const COMMITMENT_ITEMS = [
  {
    id: "track",
    text: "Я буду вести учёт доходов и расходов, чтобы всё контролировать",
    emoji: "💰",
    themeId: "pink" as const,
  },
  {
    id: "habits",
    text: "Я создам полезные финансовые привычки",
    emoji: "✨",
    themeId: "mint" as const,
  },
  {
    id: "dream",
    text: "Я буду откладывать на свою мечту",
    emoji: "💗",
    themeId: "lavender" as const,
  },
  {
    id: "goals",
    text: "Я буду следить за своими целями и не сдамся",
    emoji: "🎯",
    themeId: "blue" as const,
  },
  {
    id: "grow",
    text: "Я буду вкладывать в себя и расти каждый день",
    emoji: "📈",
    themeId: "neutral" as const,
  },
] as const

export const PROFILE_ANALYSIS_STEPS = [
  "Анализируем ответы...",
  "Создаём финансовый профиль...",
  "Настраиваем под тебя...",
  "Готово!",
] as const

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
