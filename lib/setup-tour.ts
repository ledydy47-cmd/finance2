import type { BudgetEntry } from "./types"

export const SETUP_TOUR_TOTAL_STEPS = 3

export const SETUP_TOUR_CATEGORIES: BudgetEntry[] = [
  { id: "cat-products", name: "Продукты", amount: 0 },
  { id: "cat-cafe", name: "Кафе и доставка", amount: 0 },
  { id: "cat-beauty", name: "Косметика", amount: 0 },
  { id: "cat-transport", name: "Транспорт", amount: 0 },
]

export const DEFAULT_GOAL_IMAGE = "/images/goal-sochi.png"
