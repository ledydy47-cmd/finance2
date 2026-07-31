import type { AppData } from "@/lib/types"

export type RemoteUserProgress = {
  onboardingCompleted?: boolean
  homeWalkthroughCompleted?: boolean
  firstExpenseAdded?: boolean
  paywallShown?: boolean
  userName?: string | null
  age?: number | null
}

export async function fetchUserProgress(userKey: string) {
  const response = await fetch(
    `/api/user/progress?userKey=${encodeURIComponent(userKey)}`,
    { cache: "no-store" },
  )
  if (!response.ok) return null

  const payload = (await response.json()) as {
    progress?: RemoteUserProgress | null
  }

  return payload.progress ?? null
}

export function mergeServerProgressIntoAppData(
  data: AppData,
  progress: RemoteUserProgress,
): AppData {
  return {
    ...data,
    settings: {
      ...data.settings,
      ...(progress.onboardingCompleted ? { onboardingCompleted: true } : {}),
      ...(progress.homeWalkthroughCompleted ? { homeWalkthroughCompleted: true } : {}),
      ...(progress.firstExpenseAdded ? { firstExpenseAdded: true } : {}),
      ...(progress.paywallShown ? { paywallShown: true } : {}),
      ...(progress.userName?.trim() ? { userName: progress.userName.trim() } : {}),
      ...(progress.age != null ? { age: progress.age } : {}),
    },
  }
}
