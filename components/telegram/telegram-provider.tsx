"use client"

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react"
import {
  ensureTelegramSdk,
  getWebApp,
  initTelegramWebApp,
  openExternalLink,
  waitForTelegramWebApp,
  type TelegramUser,
} from "@/lib/telegram"

interface TelegramContextValue {
  isTelegram: boolean
  isReady: boolean
  user: TelegramUser | null
  platform: string
  openLink: (url: string) => void
}

const TelegramContext = createContext<TelegramContextValue>({
  isTelegram: false,
  isReady: false,
  user: null,
  platform: "unknown",
  openLink: openExternalLink,
})

export function TelegramProvider({ children }: { children: ReactNode }) {
  const [isReady, setIsReady] = useState(false)
  const [snapshot, setSnapshot] = useState({
    isTelegram: false,
    user: null as TelegramUser | null,
    platform: "unknown",
  })

  useEffect(() => {
    let cancelled = false

    void waitForTelegramWebApp(1500)
      .then(() => ensureTelegramSdk())
      .catch(() => undefined)
      .finally(() => {
        if (cancelled) return
        initTelegramWebApp()
        const webApp = getWebApp()
        setSnapshot({
          isTelegram: Boolean(webApp?.initData),
          user: webApp?.initDataUnsafe?.user ?? null,
          platform: webApp?.platform ?? "unknown",
        })
        setIsReady(true)
      })

    return () => {
      cancelled = true
    }
  }, [])

  const value = useMemo(
    () => ({
      isTelegram: snapshot.isTelegram,
      isReady,
      user: snapshot.user,
      platform: snapshot.platform,
      openLink: openExternalLink,
    }),
    [snapshot, isReady],
  )

  return <TelegramContext.Provider value={value}>{children}</TelegramContext.Provider>
}

export function useTelegram() {
  return useContext(TelegramContext)
}

export type { TelegramUser }
