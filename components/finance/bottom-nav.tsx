"use client"

import { Home, PieChart, Target, LineChart, Settings } from "lucide-react"
import { useFinance } from "@/context/finance-context"
import type { TabId } from "@/lib/types"

const tabs: { id: TabId; label: string; icon: typeof Home }[] = [
  { id: "home", label: "Главная", icon: Home },
  { id: "stats", label: "Статистика", icon: PieChart },
  { id: "goals", label: "Цели", icon: Target },
  { id: "analytics", label: "Аналитика", icon: LineChart },
  { id: "settings", label: "Настройки", icon: Settings },
]

export function BottomNav() {
  const { activeTab, setActiveTab } = useFinance()

  return (
    <nav className="border-t border-border/60 bg-card/95 px-2 pb-6 pt-2 backdrop-blur">
      <ul className="flex items-center justify-between">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id
          const Icon = tab.icon
          return (
            <li key={tab.id} className="flex-1">
              <button
                type="button"
                onClick={() => setActiveTab(tab.id)}
                aria-current={isActive ? "page" : undefined}
                className="flex w-full flex-col items-center gap-1 rounded-block-sm py-1.5 transition-colors"
              >
                <span
                  className={`flex size-9 items-center justify-center rounded-block-sm transition-colors ${
                    isActive ? "bg-primary/15" : "bg-transparent"
                  }`}
                >
                  <Icon
                    className="size-[19px]"
                    strokeWidth={2.2}
                    style={{ color: isActive ? "var(--primary)" : "var(--muted-foreground)" }}
                  />
                </span>
                <span
                  className={`text-[10px] font-semibold ${
                    isActive ? "text-primary" : "text-muted-foreground"
                  }`}
                >
                  {tab.label}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
