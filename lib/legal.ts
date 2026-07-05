export const SUPPORT_EMAIL = "parshinadiana@yandex.ru"

export function supportMailtoUrl(message?: string) {
  const subject = encodeURIComponent("Вопрос по сервису «Мани.точка»")
  const body = encodeURIComponent(message?.trim() || "")
  return `mailto:${SUPPORT_EMAIL}?subject=${subject}${body ? `&body=${body}` : ""}`
}
