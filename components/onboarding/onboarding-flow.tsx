"use client"

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { Cake, Hand } from "lucide-react"
import { OnboardingMascot } from "@/components/onboarding/onboarding-mascot"
import { useTelegram } from "@/components/telegram/telegram-provider"
import { useFinance } from "@/context/finance-context"
import {
  CURRENCY_OPTIONS,
  FINANCE_FEELING_OPTIONS,
  MONEY_PROBLEM_OPTIONS,
  ONBOARDING_TOTAL_STEPS,
  SAVINGS_PRESETS,
  SAVING_MOTIVATION_OPTIONS,
  createOnboardingDraft,
  type OnboardingDraft,
} from "@/lib/onboarding"
import { formatRub } from "@/lib/format"
import { parseAmount } from "@/lib/budget-planner"
import { clearAllAppDataAndReload, resetOnboardingAndReload } from "@/lib/dev-reset"
import { OnboardingContractStep } from "@/components/onboarding/onboarding-contract-step"
import { OnboardingGoodNewsStep } from "@/components/onboarding/onboarding-good-news-step"
import { OnboardingLongTermHabitsStep } from "@/components/onboarding/onboarding-long-term-habits-step"
import { OnboardingProfileAnalysisStep } from "@/components/onboarding/onboarding-profile-analysis-step"
import { OnboardingTracking30DaysStep } from "@/components/onboarding/onboarding-tracking-30-days-step"
import { OnboardingThemeStep } from "@/components/theme/theme-picker"

function OnboardingDevBar() {
  const handleRestart = () => {
    if (
      !window.confirm(
        "Начать онбординг сначала? Текущий прогресс шагов сбросится.",
      )
    ) {
      return
    }
    resetOnboardingAndReload()
  }

  const handleClearAll = () => {
    if (
      !window.confirm(
        "Удалить все данные приложения? Транзакции, цели и настройки будут стёрты.",
      )
    ) {
      return
    }
    clearAllAppDataAndReload()
  }

  return (
    <div className="shrink-0 flex items-center justify-center gap-3 border-t border-border/50 bg-background/95 px-4 py-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))] text-xs backdrop-blur">
      <button
        type="button"
        onClick={handleRestart}
        className="font-semibold text-primary underline-offset-2 hover:underline"
      >
        Сбросить онбординг
      </button>
      <span className="text-muted-foreground/35" aria-hidden>
        ·
      </span>
      <button
        type="button"
        onClick={handleClearAll}
        className="font-semibold text-destructive underline-offset-2 hover:underline"
      >
        Сбросить всё
      </button>
    </div>
  )
}

function OnboardingProgress({ step }: { step: number }) {
  const progress = ((step + 1) / ONBOARDING_TOTAL_STEPS) * 100
  return (
    <div className="shrink-0 px-6 pt-1.5">
      <div className="h-2.5 overflow-hidden rounded-full bg-secondary/80">
        <div
          className="onboarding-progress-fill h-full rounded-full transition-all duration-500 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  )
}

const PROFILE_SETUP_HINT =
  "Ответь на пару вопросов, и мы настроим всё специально для тебя"

function ProfileDots({ activeIndex }: { activeIndex: number }) {
  return (
    <div className="mb-4 flex justify-center gap-2">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className={`flex size-7 items-center justify-center rounded-full text-xs font-bold transition-colors ${
            i === activeIndex
              ? "bg-primary text-primary-foreground"
              : "bg-secondary text-muted-foreground"
          }`}
        >
          {i + 1}
        </span>
      ))}
    </div>
  )
}

function OptionButton({
  selected,
  label,
  emoji,
  onClick,
}: {
  selected: boolean
  label: string
  emoji: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-block-sm px-4 py-3.5 text-left text-sm font-semibold transition-all active:scale-[0.98] ${
        selected
          ? "bg-primary/15 ring-2 ring-primary"
          : "bg-card shadow-sm shadow-primary/5"
      }`}
    >
      <span className="text-xl">{emoji}</span>
      {label}
    </button>
  )
}

function OnboardingStepShell({
  step,
  stepEnterClass,
  canContinue,
  buttonLabel,
  onNext,
  footerSubtitle,
  hideButton,
  children,
}: {
  step: number
  stepEnterClass: string
  canContinue: boolean
  buttonLabel: string
  onNext: () => void
  footerSubtitle?: string
  hideButton?: boolean
  children: ReactNode
}) {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain" data-onboarding-scroll>
      <div className="flex flex-col items-center px-6 pt-6 pb-[max(2rem,env(safe-area-inset-bottom))]">
        <div
          key={step}
          className={`flex w-full max-w-sm flex-col items-center text-center ${stepEnterClass}`}
        >
          {children}
          {!hideButton && (
            <>
              <button
                type="button"
                disabled={!canContinue}
                onClick={onNext}
                className="mt-8 w-full rounded-block-sm bg-primary py-4 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/30 transition-transform active:scale-[0.97] disabled:opacity-40"
              >
                {buttonLabel}
              </button>
              {footerSubtitle && (
                <p className="mt-3 text-center text-xs leading-relaxed text-muted-foreground">
                  {footerSubtitle}
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export function OnboardingFlow() {
  const { data, completeOnboarding } = useFinance()
  const { user } = useTelegram()
  const [step, setStep] = useState(0)
  const [direction, setDirection] = useState(1)
  const prevStepRef = useRef(step)
  const nameInputRef = useRef<HTMLInputElement>(null)
  const [draft, setDraft] = useState<OnboardingDraft>(() =>
    createOnboardingDraft(data.settings.userName || user?.first_name || ""),
  )
  const [customSavingsMode, setCustomSavingsMode] = useState(false)

  useEffect(() => {
    setDirection(step >= prevStepRef.current ? 1 : -1)
    prevStepRef.current = step
  }, [step])

  useEffect(() => {
    if (step !== 1 && step !== 11) return
    const viewport = window.visualViewport
    if (!viewport) return

    const keepInputVisible = () => {
      const active = document.activeElement
      if (active instanceof HTMLElement) {
        active.scrollIntoView({ block: "center", behavior: "smooth" })
      }
    }

    viewport.addEventListener("resize", keepInputVisible)
    return () => viewport.removeEventListener("resize", keepInputVisible)
  }, [step])

  const patch = (partial: Partial<OnboardingDraft>) =>
    setDraft((prev) => ({ ...prev, ...partial }))

  const canContinue = useMemo(() => {
    switch (step) {
      case 0:
        return true
      case 1:
        return draft.name.trim().length > 0
      case 2:
        return true
      case 3:
        return true
      case 4:
        return Boolean(draft.savingMotivation)
      case 5:
        return Boolean(draft.moneyProblem)
      case 6:
        return Boolean(draft.financeFeeling)
      case 7:
      case 8:
      case 9:
        return true
      case 10:
        return true
      case 11:
        if (customSavingsMode) return parseAmount(draft.customSavings) > 0
        return draft.monthlySavings !== null
      case 12:
        return true
      default:
        return false
    }
  }, [step, draft, customSavingsMode])

  function finishOnboarding() {
    const monthlySavings = customSavingsMode
      ? parseAmount(draft.customSavings)
      : (draft.monthlySavings ?? 5000)

    completeOnboarding({
      name: draft.name.trim(),
      age: draft.age,
      savingMotivation: draft.savingMotivation,
      moneyProblem: draft.moneyProblem,
      financeFeeling: draft.financeFeeling,
      currency: draft.currency,
      monthlySavings,
    })
  }

  const finishOnboardingRef = useRef(finishOnboarding)
  finishOnboardingRef.current = finishOnboarding

  const handleAnalysisComplete = useCallback(() => {
    finishOnboardingRef.current()
  }, [])

  function handleNext() {
    if (!canContinue) return
    if (step >= ONBOARDING_TOTAL_STEPS - 1) return
    setStep((s) => s + 1)
  }

  const buttonLabel =
    step === 0
      ? "Начать"
      : step === 7
        ? "Начать вести учёт 📊"
        : step === 12
          ? "Беру на себя обязательство 💗"
          : "Далее"
  const stepEnterClass =
    direction > 0 ? "onboarding-step-enter-forward" : "onboarding-step-enter-back"

  const shellProps = {
    step,
    stepEnterClass,
    canContinue,
    buttonLabel,
    onNext: handleNext,
  }

  return (
    <div className="absolute inset-0 z-50 flex flex-col overflow-hidden bg-background">
      <OnboardingProgress step={step} />

      {step === 0 && (
        <OnboardingStepShell {...shellProps}>
          <div className="mb-6">
            <OnboardingMascot size="hero" />
          </div>
          <h1 className="font-serif text-3xl font-bold text-foreground">Добро пожаловать!</h1>
          <p className="mt-2 max-w-[18rem] text-base leading-relaxed text-muted-foreground">
            Планируй бюджет и копи на мечту 💗
          </p>
        </OnboardingStepShell>
      )}

      {step === 1 && (
        <OnboardingStepShell {...shellProps}>
          <div className="mx-auto mb-6 flex size-16 items-center justify-center rounded-full bg-primary/15 shadow-sm shadow-primary/5">
            <Hand className="size-8 text-primary" strokeWidth={2.2} />
          </div>
          <h2 className="font-serif text-2xl font-bold text-foreground">Как тебя зовут?</h2>
          <p className="mt-2 text-sm text-muted-foreground">Будем обращаться по имени на главной</p>
          <input
            ref={nameInputRef}
            value={draft.name}
            onChange={(e) => patch({ name: e.target.value })}
            onFocus={(e) => e.target.scrollIntoView({ block: "center", behavior: "smooth" })}
            placeholder="Введите имя"
            className="mt-6 w-full rounded-block-sm border border-border bg-card px-4 py-4 text-base font-semibold outline-none ring-primary focus:ring-2"
            autoFocus
          />
        </OnboardingStepShell>
      )}

      {step === 2 && (
        <OnboardingStepShell {...shellProps}>
          <div className="mx-auto mb-6 flex size-16 items-center justify-center rounded-full bg-primary/15">
            <Cake className="size-8 text-primary" strokeWidth={2.2} />
          </div>
          <h2 className="font-serif text-2xl font-bold text-foreground">Сколько тебе лет?</h2>
          <p className="mt-8 text-center font-serif text-6xl font-bold text-primary">{draft.age}</p>
          <input
            type="range"
            min={10}
            max={100}
            value={draft.age}
            onChange={(e) => patch({ age: Number(e.target.value) })}
            className="mt-8 w-full accent-[var(--primary)]"
          />
          <div className="mt-2 flex justify-between text-xs text-muted-foreground">
            <span>10</span>
            <span>100</span>
          </div>
        </OnboardingStepShell>
      )}

      {step === 3 && (
        <OnboardingStepShell {...shellProps}>
          <OnboardingThemeStep />
        </OnboardingStepShell>
      )}

      {step === 4 && (
        <OnboardingStepShell {...shellProps}>
          <ProfileDots activeIndex={0} />
          <h2 className="font-serif text-xl font-bold text-foreground">Что мотивирует тебя копить?</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{PROFILE_SETUP_HINT}</p>
          <div className="mt-4 flex flex-col gap-2">
            {SAVING_MOTIVATION_OPTIONS.map((opt) => (
              <OptionButton
                key={opt.id}
                selected={draft.savingMotivation === opt.id}
                label={opt.label}
                emoji={opt.emoji}
                onClick={() => patch({ savingMotivation: opt.id })}
              />
            ))}
          </div>
        </OnboardingStepShell>
      )}

      {step === 5 && (
        <OnboardingStepShell {...shellProps}>
          <ProfileDots activeIndex={1} />
          <h2 className="font-serif text-xl font-bold text-foreground">Главная проблема с деньгами?</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{PROFILE_SETUP_HINT}</p>
          <div className="mt-4 flex flex-col gap-2">
            {MONEY_PROBLEM_OPTIONS.map((opt) => (
              <OptionButton
                key={opt.id}
                selected={draft.moneyProblem === opt.id}
                label={opt.label}
                emoji={opt.emoji}
                onClick={() => patch({ moneyProblem: opt.id })}
              />
            ))}
          </div>
        </OnboardingStepShell>
      )}

      {step === 6 && (
        <OnboardingStepShell {...shellProps}>
          <ProfileDots activeIndex={2} />
          <h2 className="font-serif text-xl font-bold text-foreground">
            Что ты чувствуешь, проверяя финансы?
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{PROFILE_SETUP_HINT}</p>
          <div className="mt-4 flex flex-col gap-2">
            {FINANCE_FEELING_OPTIONS.map((opt) => (
              <OptionButton
                key={opt.id}
                selected={draft.financeFeeling === opt.id}
                label={opt.label}
                emoji={opt.emoji}
                onClick={() => patch({ financeFeeling: opt.id })}
              />
            ))}
          </div>
        </OnboardingStepShell>
      )}

      {step === 7 && (
        <OnboardingStepShell {...shellProps} buttonLabel="Начать вести учёт 📊">
          <OnboardingTracking30DaysStep />
        </OnboardingStepShell>
      )}

      {step === 8 && (
        <OnboardingStepShell {...shellProps}>
          <OnboardingGoodNewsStep />
        </OnboardingStepShell>
      )}

      {step === 9 && (
        <OnboardingStepShell {...shellProps}>
          <OnboardingLongTermHabitsStep name={draft.name.trim() || data.settings.userName} />
        </OnboardingStepShell>
      )}

      {step === 10 && (
        <OnboardingStepShell {...shellProps}>
          <h2 className="font-serif text-2xl font-bold text-foreground">Выбери валюту</h2>
          <p className="mt-2 text-sm text-muted-foreground">Сейчас доступен российский рубль</p>
          <select
            value={draft.currency}
            onChange={(e) => patch({ currency: e.target.value as "RUB" })}
            className="mt-6 w-full rounded-block-sm border border-border bg-card px-4 py-4 text-base font-semibold outline-none ring-primary focus:ring-2"
          >
            {CURRENCY_OPTIONS.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </OnboardingStepShell>
      )}

      {step === 11 && (
        <OnboardingStepShell {...shellProps}>
          <h2 className="font-serif text-xl font-bold text-foreground">
            Сколько хочешь откладывать в месяц?
          </h2>
          <div className="mt-4 grid grid-cols-2 gap-2">
            {SAVINGS_PRESETS.map((amount) => (
              <button
                key={amount}
                type="button"
                onClick={() => {
                  setCustomSavingsMode(false)
                  patch({ monthlySavings: amount, customSavings: "" })
                }}
                className={`rounded-block-sm px-3 py-3 text-sm font-bold transition-all active:scale-[0.98] ${
                  !customSavingsMode && draft.monthlySavings === amount
                    ? "bg-primary text-primary-foreground shadow-sm shadow-primary/25"
                    : "bg-card text-foreground shadow-sm shadow-primary/5"
                }`}
              >
                {formatRub(amount)}
              </button>
            ))}
            <button
              type="button"
              onClick={() => {
                setCustomSavingsMode(true)
                patch({ monthlySavings: null })
              }}
              className={`col-span-2 rounded-block-sm px-3 py-3 text-sm font-bold transition-all active:scale-[0.98] ${
                customSavingsMode
                  ? "bg-primary text-primary-foreground shadow-sm shadow-primary/25"
                  : "bg-card text-foreground shadow-sm shadow-primary/5"
              }`}
            >
              Своя сумма
            </button>
          </div>
          {customSavingsMode && (
            <input
              value={draft.customSavings}
              onChange={(e) => patch({ customSavings: e.target.value })}
              onFocus={(e) => e.target.scrollIntoView({ block: "center", behavior: "smooth" })}
              placeholder="Введите сумму"
              inputMode="numeric"
              className="mt-4 w-full rounded-block-sm border border-border bg-card px-4 py-4 text-base font-semibold outline-none ring-primary focus:ring-2"
              autoFocus
            />
          )}
        </OnboardingStepShell>
      )}

      {step === 12 && (
        <OnboardingStepShell
          {...shellProps}
          buttonLabel="Беру на себя обязательство 💗"
          footerSubtitle="Обещание самой себе помогает довести дело до конца"
        >
          <OnboardingContractStep name={draft.name.trim() || data.settings.userName} />
        </OnboardingStepShell>
      )}

      {step === 13 && (
        <OnboardingProfileAnalysisStep
          onComplete={handleAnalysisComplete}
          stepEnterClass={stepEnterClass}
        />
      )}

      <OnboardingDevBar />
    </div>
  )
}
