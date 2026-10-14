/** Remind to add the first expense 2 hours after the home walkthrough. */
export const FIRST_EXPENSE_NUDGE_DELAY_MS = 2 * 60 * 60 * 1000

const MOSCOW = "Europe/Moscow"

export function formatFirstExpenseNudge(userName: string | null) {
  const name = userName?.trim()
  const lead = name
    ? `${name}, обучение пройдено — бюджет уже есть, не хватает одной настоящей траты.`
    : "Обучение пройдено — бюджет уже есть, не хватает одной настоящей траты."
  return [
    lead,
    "",
    "Открой «Мани.точку» и нажми «+»: кофе, такси, продукты, что угодно за сегодня. После этого будет видно, сколько реально осталось, а не только план 💗",
  ].join("\n")
}

function moscowParts(ms: number) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: MOSCOW,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(ms))
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value)
  const hour = read("hour")

  return {
    year: read("year"),
    month: read("month"),
    day: read("day"),
    hour: hour === 24 ? 0 : hour,
  }
}

/** 23:00–10:00 Moscow. 10:00 itself is already morning, so a nudge due then goes out. */
function isQuietMoscowHour(hour: number) {
  return hour >= 23 || hour < 10
}

function moscowMorningMs(year: number, month: number, day: number) {
  return Date.UTC(year, month - 1, day, 7, 30, 0, 0)
}

export function firstExpenseNudgeDueMs(walkthroughCompletedAt: string) {
  const completedMs = new Date(walkthroughCompletedAt).getTime()
  if (Number.isNaN(completedMs)) return Number.NaN

  const dueMs = completedMs + FIRST_EXPENSE_NUDGE_DELAY_MS
  const moscow = moscowParts(dueMs)
  if (!isQuietMoscowHour(moscow.hour)) return dueMs

  const day = moscow.hour >= 23 ? moscow.day + 1 : moscow.day
  return moscowMorningMs(moscow.year, moscow.month, day)
}
