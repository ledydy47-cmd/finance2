import {
  getUserAnalyticsRecord,
} from "@/lib/server/user-analytics-store"
import {
  hasAddedFirstExpense,
  hasCompletedWalkthrough,
} from "@/lib/server/user-analytics-service"

export async function getUserProgressFlags(userKey: string) {
  const user = await getUserAnalyticsRecord(userKey)
  if (!user) return null

  return {
    onboardingCompleted: Boolean(user.onboardingCompletedAt),
    homeWalkthroughCompleted: hasCompletedWalkthrough(user),
    firstExpenseAdded: hasAddedFirstExpense(user),
    paywallShown: Boolean(user.paywallShownAt),
    userName: user.userName,
    age: user.age,
  }
}
