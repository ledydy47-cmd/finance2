"use client"

import { RotateCcw, Trash2 } from "lucide-react"
import { clearAllAppDataAndReload, resetOnboardingAndReload } from "@/lib/dev-reset"

export function SettingsDevTools() {
  const handleResetOnboarding = () => {
    if (
      !window.confirm(
        "Сбросить онбординг? Приложение перезагрузится, и вы снова увидите экран приветствия.",
      )
    ) {
      return
    }
    resetOnboardingAndReload()
  }

  const handleResetAllData = () => {
    if (
      !window.confirm(
        "Удалить все данные приложения? Транзакции, цели и настройки будут стёрты без возможности восстановления.",
      )
    ) {
      return
    }
    clearAllAppDataAndReload()
  }

  return (
    <div
      data-settings-debug
      className="mt-4 rounded-block border-2 border-primary/40 bg-card p-4 shadow-md shadow-primary/10"
    >
      <h2 className="font-serif text-base font-bold text-foreground">Отладка</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Для разработки и тестирования онбординга
      </p>
      <div className="mt-3 flex flex-col gap-2">
        <button
          type="button"
          onClick={handleResetOnboarding}
          className="flex w-full items-center justify-center gap-2 rounded-block-sm bg-primary py-3.5 text-sm font-bold text-primary-foreground shadow-sm shadow-primary/25 transition-transform active:scale-[0.98]"
        >
          <RotateCcw className="size-4" strokeWidth={2.2} />
          Сбросить онбординг
        </button>
        <button
          type="button"
          onClick={handleResetAllData}
          className="flex w-full items-center justify-center gap-2 rounded-block-sm border border-destructive/30 bg-destructive/10 py-3 text-sm font-semibold text-destructive transition-transform active:scale-[0.98]"
        >
          <Trash2 className="size-4" strokeWidth={2.2} />
          Сбросить все данные
        </button>
      </div>
    </div>
  )
}
