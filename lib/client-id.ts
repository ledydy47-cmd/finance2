const CLIENT_ID_KEY = "kopilka-client-id"

export function getClientUserKey(telegramUserId?: number | null) {
  if (telegramUserId) return `tg-${telegramUserId}`
  if (typeof window === "undefined") return "anonymous"

  let clientId = localStorage.getItem(CLIENT_ID_KEY)
  if (!clientId) {
    clientId = crypto.randomUUID()
    localStorage.setItem(CLIENT_ID_KEY, clientId)
  }
  return `web-${clientId}`
}
