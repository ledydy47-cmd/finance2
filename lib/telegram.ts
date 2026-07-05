export interface TelegramUser {
  id: number
  first_name: string
  last_name?: string
  username?: string
  language_code?: string
  photo_url?: string
}

interface TelegramWebApp {
  initData: string
  platform: string
  initDataUnsafe: {
    user?: TelegramUser
  }
  ready: () => void
  expand: () => void
  disableVerticalSwipes?: () => void
  setHeaderColor: (color: string) => void
  setBackgroundColor: (color: string) => void
  openLink: (url: string) => void
  HapticFeedback?: {
    impactOccurred: (style: "light" | "medium" | "heavy") => void
  }
  BackButton: {
    show: () => void
    hide: () => void
    onClick: (cb: () => void) => void
    offClick: (cb: () => void) => void
  }
}

declare global {
  interface Window {
    Telegram?: {
      WebApp: TelegramWebApp
    }
  }
}

const BASE_STORAGE_KEY = "kopilka-finance-data"

let sdkLoadPromise: Promise<void> | null = null

/** Load @twa-dev/sdk on the client only (registers window.Telegram.WebApp). */
export function ensureTelegramSdk(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve()
  if (window.Telegram?.WebApp) return Promise.resolve()
  if (!sdkLoadPromise) {
    sdkLoadPromise = import("@twa-dev/sdk").then(() => undefined)
  }
  return sdkLoadPromise
}

export function getWebApp(): TelegramWebApp | null {
  if (typeof window === "undefined") return null
  return window.Telegram?.WebApp ?? null
}

export function isTelegramMiniApp(): boolean {
  return Boolean(getWebApp()?.initData)
}

export function getTelegramUser(): TelegramUser | null {
  return getWebApp()?.initDataUnsafe?.user ?? null
}

export function getStorageKey(): string {
  if (typeof window === "undefined") return BASE_STORAGE_KEY
  const userId = getTelegramUser()?.id
  return userId ? `${BASE_STORAGE_KEY}-${userId}` : BASE_STORAGE_KEY
}

export function openExternalLink(url: string) {
  if (typeof window === "undefined") return
  const webApp = getWebApp()
  if (webApp?.initData) {
    webApp.openLink(url)
    return
  }
  window.open(url, "_blank", "noopener,noreferrer")
}

export function initTelegramWebApp() {
  const webApp = getWebApp()
  if (!webApp?.initData) return

  webApp.ready()
  webApp.expand()
  webApp.disableVerticalSwipes?.()

  try {
    webApp.setHeaderColor("secondary_bg_color")
    webApp.setBackgroundColor("bg_color")
  } catch {
    // Some clients reject theme tokens
  }
}

export function hapticLight() {
  try {
    getWebApp()?.HapticFeedback?.impactOccurred("light")
  } catch {
    // optional
  }
}
