export type SupportTicketStatus = "open" | "answered"
export type SupportTicketSource = "app" | "bot"

export interface SupportTicket {
  id: string
  userKey: string
  telegramUserId: number | null
  telegramUsername: string | null
  userName: string | null
  message: string
  source: SupportTicketSource
  status: SupportTicketStatus
  reply: string | null
  createdAt: string
  repliedAt: string | null
}

export interface SupportStoreSnapshot {
  tickets: Record<string, SupportTicket>
}
