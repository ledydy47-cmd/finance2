import type { AppData } from "./types"
import { createDefaultData } from "./default-data"
import { CATEGORY_ICON_IMAGES } from "./category-icons"
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
  const budgetPlan =
    migrateLegacyBudgetPlan(data.budgetPlan as Record<string, unknown> | undefined, data.categories) ??
    defaults.budgetPlan

  let categories = data.categories.map((category) => {
    const iconImage = CATEGORY_ICON_IMAGES[category.id]
    const kind = category.kind ?? "flexible"
    return {
      ...category,
      kind,
      ...(iconImage ? { iconImage } : {}),
      ...(category.id === "cat-beauty" ? { name: "Косметика" } : {}),
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

  const missingDefaults = defaults.categories.filter(
    (c) => c.kind === "flexible" && !categories.some((x) => x.id === c.id),
  )

  return {
    ...data,
    categories: [...categories, ...missingDefaults],
    budgetPlan,
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
    },
  }
}

export function saveAppData(data: AppData) {
  if (typeof window === "undefined") return
  localStorage.setItem(getStorageKey(), JSON.stringify(data))
}
