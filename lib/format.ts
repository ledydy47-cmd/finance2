const MONTHS = [
  "Январь",
  "Февраль",
  "Март",
  "Апрель",
  "Май",
  "Июнь",
  "Июль",
  "Август",
  "Сентябрь",
  "Октябрь",
  "Ноябрь",
  "Декабрь",
]

export function formatRub(value: number) {
  return `${Math.round(value).toLocaleString("ru-RU")} ₽`
}

export function formatMonthYear(date: Date) {
  return `${MONTHS[date.getMonth()]} ${date.getFullYear()}`
}

export function formatShortMonth(date: Date) {
  return `${MONTHS[date.getMonth()].slice(0, 3)} ${date.getFullYear()}`
}

export function formatRelativeDay(dateStr: string) {
  const date = new Date(dateStr)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const target = new Date(date)
  target.setHours(0, 0, 0, 0)
  const diff = Math.round((today.getTime() - target.getTime()) / 86400000)

  if (diff === 0) return "Сегодня"
  if (diff === 1) return "Вчера"
  return date.toLocaleDateString("ru-RU", { day: "numeric", month: "short" })
}

export function formatPercent(value: number, total: number) {
  if (total <= 0) return 0
  return Math.min(100, Math.round((value / total) * 100))
}
