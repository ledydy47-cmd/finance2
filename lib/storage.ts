import type { AppData } from "./types"
import { createDefaultData } from "./default-data"
import { emojiForCategoryId } from "./category-icons"
import { DEFAULT_THEME_ID, isThemeId } from "./themes"
import {
  buildCategoriesFromPlan,
  migrateLegacyBudgetPlan,
} from "./budget-planner"
import { getStorageKey } from "./telegram"

export function loadAppData(): AppData {
  if (typeof window === "undefined") return createDefaultData()

  try {
    const raw = localStorage.getItem(getStorageKey())
    if (!raw) return createDefaultData()
    const parsed = JSON.parse(raw) as Partial<AppData>
    const defaults = createDefaultData()
    const merged = {
      ...defaults,
      ...parsed,
      settings: { ...defaults.settings, ...parsed.settings },
    } as AppData
    return migrateData(merged, defaults)
  } catch {
    return createDefaultData()
  }
}

function migrateData(data: AppData, defaults: AppData): AppData {
  const budgetPlanRaw =
    migrateLegacyBudgetPlan(data.budgetPlan as Record<string, unknown> | undefined, data.categories) ??
    defaults.budgetPlan

  const budgetPlan = budgetPlanRaw
    ? {
        ...budgetPlanRaw,
        mandatoryExpenses: budgetPlanRaw.mandatoryExpenses.map((entry) =>
          entry.id === "cat-rent" && entry.name === "Аренда"
            ? { ...entry, name: "Жилье" }
            : entry,
        ),
      }
    : budgetPlanRaw

  let categories = data.categories.map((category) => {
    const kind = category.kind ?? "flexible"
    const { iconImage: _removed, ...rest } = category
    return {
      ...rest,
      kind,
      icon: emojiForCategoryId(category.id, category.icon),
      ...(category.id === "cat-beauty" ? { name: "Косметика" } : {}),
      ...(category.id === "cat-rent" && category.name === "Аренда" ? { name: "Жилье" } : {}),
    }
  })

  const hasMandatory = categories.some((c) => c.kind === "mandatory")
  if (!hasMandatory && budgetPlan?.mandatoryExpenses.length) {
    const mandatoryCats = buildCategoriesFromPlan(
      budgetPlan.mandatoryExpenses,
      [],
      categories,
    )
    categories = [...mandatoryCats, ...categories.filter((c) => c.kind !== "mandatory")]
  }

  return {
    ...data,
    categories,
    budgetPlan,
    goals: data.goals.map((goal) => ({
      ...goal,
      completed: goal.completed ?? false,
      completionCelebrated: goal.completionCelebrated ?? false,
    })),
    settings: {
      ...data.settings,
      primaryGoalId: data.settings.primaryGoalId ?? data.goals[0]?.id ?? null,
      onboardingCompleted:
        data.settings.onboardingCompleted ??
        Boolean(data.settings.userName?.trim()),
      homeWalkthroughCompleted:
        data.settings.homeWalkthroughCompleted ??
        Boolean(
          (data.settings as { setupTourCompleted?: boolean }).setupTourCompleted ??
            data.settings.onboardingCompleted,
        ),
      themeId: isThemeId(data.settings.themeId ?? "")
        ? data.settings.themeId
        : DEFAULT_THEME_ID,
      firstExpenseAdded: data.settings.firstExpenseAdded ?? false,
      paywallShown: data.settings.paywallShown ?? false,
      isSubscribed: data.settings.isSubscribed ?? false,
      subscriptionPlan: data.settings.subscriptionPlan ?? null,
      subscriptionExpiresAt: data.settings.subscriptionExpiresAt ?? null,
      lastPaymentId: data.settings.lastPaymentId ?? null,
      autoRenew: data.settings.autoRenew ?? true,
      subscriptionStatus: data.settings.subscriptionStatus,
    },
  }
}

export function saveAppData(data: AppData) {
  if (typeof window === "undefined") return
  localStorage.setItem(getStorageKey(), JSON.stringify(data))
}
