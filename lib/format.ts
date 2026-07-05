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

function ruPlural(n: number, one: string, few: string, many: string) {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return one
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few
  return many
}

export function formatOperationsCount(count: number) {
  return `${count} ${ruPlural(count, "операция", "операции", "операций")}`
}

export function formatDaysLeftLabel(days: number) {
  return `${ruPlural(days, "осталось", "осталось", "осталось")} ${days} ${ruPlural(days, "день", "дня", "дней")}`
}
