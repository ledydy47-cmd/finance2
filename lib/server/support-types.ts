export type SupportTicketStatus = "open" | "answered"

export interface SupportTicket {
  id: string
  userKey: string
  telegramUserId: number | null
  telegramUsername: string | null
  userName: string | null
  message: string
  status: SupportTicketStatus
  reply: string | null
  createdAt: string
  repliedAt: string | null
}

export interface SupportStoreSnapshot {
  tickets: Record<string, SupportTicket>
}
