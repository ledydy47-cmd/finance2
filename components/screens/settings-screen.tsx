"use client"

import { ThemePicker } from "@/components/theme/theme-picker"
import { LegalLinks } from "@/components/legal/legal-links"
import { SubscriptionManagement } from "@/components/subscription/subscription-management"
import { SupportSection } from "@/components/support/support-section"
import { useTelegram } from "@/components/telegram/telegram-provider"
import { useFinance } from "@/context/finance-context"
import { getClientUserKey } from "@/lib/client-id"
import { useEffect } from "react"

export function SettingsScreen() {
  const { data, updateSettings, openPaywall, resetMonthSpendingManual, syncSubscriptionFromServer } =
    useFinance()
  const { isTelegram, user } = useTelegram()
  const isSubscribed = data.settings.isSubscribed

  useEffect(() => {
    if (!isSubscribed && !user?.id) return
    void syncSubscriptionFromServer(getClientUserKey(user?.id))
  }, [isSubscribed, syncSubscriptionFromServer, user?.id])

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <header className="shrink-0 px-5 pb-3 pt-4">
        <h1 className="font-serif text-2xl font-bold text-foreground">Настройки</h1>
        <p className="mt-1 text-sm text-muted-foreground">Профиль и параметры месяца</p>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-[max(8rem,env(safe-area-inset-bottom))]">
        <section className="mb-4 rounded-block bg-card p-4 shadow-sm shadow-primary/5">
          <h2 className="mb-1 font-serif text-base font-bold">Подписка</h2>
          {isSubscribed ? (
            <>
              <p className="text-sm text-muted-foreground">
                Активна
                {data.settings.subscriptionExpiresAt
                  ? ` до ${new Date(data.settings.subscriptionExpiresAt).toLocaleDateString("ru-RU")}`
                  : ""}{" "}
                · спасибо, что с нами 💗
              </p>
              <SubscriptionManagement />
            </>
          ) : (
            <>
              <p className="mb-3 text-sm text-muted-foreground">
                Оформи подписку, чтобы добавлять операции и редактировать цели и бюджет
              </p>
              <button
                type="button"
                onClick={openPaywall}
                className="w-full rounded-block-sm bg-primary py-3 text-sm font-bold text-primary-foreground shadow-sm shadow-primary/25"
              >
                Выбрать план
              </button>
            </>
          )}
        </section>

        <div className="mb-4">
          <SupportSection />
        </div>

        <section className="mb-4 rounded-block bg-card p-4 shadow-sm shadow-primary/5">
          <h2 className="mb-1 font-serif text-base font-bold">Тема 🎨</h2>
          <p className="mb-4 text-xs text-muted-foreground">Меняется сразу по всему приложению</p>
          <ThemePicker compact showPreview={false} />
        </section>

        <section className="mb-4 rounded-block bg-card p-4 shadow-sm shadow-primary/5">
          <h2 className="mb-1 font-serif text-base font-bold">Месяц</h2>
          <p className="mb-3 text-xs text-muted-foreground">
            Обнулить траты по категориям в текущем месяце. Операции сохранятся в истории.
          </p>
          <button
            type="button"
            onClick={() => {
              if (
                window.confirm(
                  "Обнулить траты за текущий месяц? Категории, доход и цели останутся без изменений.",
                )
              ) {
                resetMonthSpendingManual()
              }
            }}
            className="w-full rounded-block-sm border border-primary/25 bg-primary/10 py-3 text-sm font-bold text-primary transition-transform active:scale-[0.98]"
          >
            Обнулить траты за месяц
          </button>
        </section>

        <section className="rounded-block bg-card p-4 shadow-sm shadow-primary/5">
          <h2 className="mb-3 font-serif text-base font-bold">Профиль</h2>
          {isTelegram && user && (
            <p className="mb-3 text-xs text-muted-foreground">
              Telegram: {user.first_name}
              {user.username ? ` (@${user.username})` : ""}
            </p>
          )}
          <label className="mb-1 block text-xs font-semibold text-muted-foreground">Имя</label>
          <input
            value={data.settings.userName}
            onChange={(e) => updateSettings({ userName: e.target.value })}
            className="mb-3 w-full rounded-block-sm border border-border bg-background px-4 py-3 text-sm outline-none ring-primary focus:ring-2"
          />
          <label className="mb-1 block text-xs font-semibold text-muted-foreground">
            День начала месяца (зарплата)
          </label>
          <input
            type="number"
            min={1}
            max={28}
            value={data.settings.monthStartDay}
            onChange={(e) =>
              updateSettings({ monthStartDay: Math.min(28, Math.max(1, Number(e.target.value))) })
            }
            className="mb-3 w-full rounded-block-sm border border-border bg-background px-4 py-3 text-sm outline-none ring-primary focus:ring-2"
          />
          <p className="text-xs text-muted-foreground">Валюта: ₽ (рубль)</p>
        </section>

        <section className="mt-4 rounded-block bg-card p-4 shadow-sm shadow-primary/5">
          <h2 className="mb-2 font-serif text-base font-bold">О приложении</h2>
          <LegalLinks />
        </section>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          Категории настраиваются в «Спланировать бюджет» на главной
        </p>

        <p className="mt-2 text-center text-xs text-muted-foreground">
          Данные хранятся локально в браузере · работает офлайн
        </p>
      </div>
    </div>
  )
}
