import { loadAppData, saveAppData } from "@/lib/storage"
import { getStorageKey } from "@/lib/telegram"

export function resetOnboardingAndReload() {
  const current = loadAppData()
  saveAppData({
    ...current,
    settings: {
      ...current.settings,
      onboardingCompleted: false,
      homeWalkthroughCompleted: false,
    },
  })
  window.location.reload()
}

export function clearAllAppDataAndReload() {
  localStorage.removeItem(getStorageKey())
  window.location.reload()
}
