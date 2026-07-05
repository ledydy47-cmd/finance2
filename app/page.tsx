import { AppShell } from "@/components/app-shell"
import { TelegramProvider } from "@/components/telegram/telegram-provider"
import { ThemeApplier } from "@/components/theme/theme-applier"
import { FinanceProvider } from "@/context/finance-context"

export default function Page() {
  return (
    <TelegramProvider>
      <FinanceProvider>
        <ThemeApplier />
        <AppShell />
      </FinanceProvider>
    </TelegramProvider>
  )
}
