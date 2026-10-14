import { readJsonDataFile, writeJsonDataFile } from "@/lib/server/file-store"
import { hasKvRestConfig, kvRestGetJson, kvRestSet } from "@/lib/server/kv-rest"

const FILE_NAME = "admin-notify-recipients.json"
const KV_KEY = "kopilka:admin-notify-recipients"

/**
 * Дополнительные получатели админских уведомлений (кроме основного админа).
 * Первый в очереди по-прежнему `getAdminTelegramUserId()`.
 */
export interface AdminNotifyRecipientRecord {
  /** Telegram @username без ведущего "@" (хранится в нижнем регистре). */
  username?: string | null
  /** Явный Telegram user id — используется, если username неизвестен. */
  telegramUserId?: number | null
  /** Читаемое имя для логов. */
  label?: string | null
  /** Получать уведомления о покупке/продлении подписки. */
  purchaseNotifications?: boolean
  addedAt: string
}

export interface AdminNotifyRecipientsSnapshot {
  recipients: AdminNotifyRecipientRecord[]
}

const EMPTY_STORE: AdminNotifyRecipientsSnapshot = { recipients: [] }

export async function readAdminNotifyRecipients(): Promise<AdminNotifyRecipientsSnapshot> {
  if (hasKvRestConfig()) {
    try {
      const fromKv = await kvRestGetJson<AdminNotifyRecipientsSnapshot | null>(KV_KEY, null)
      if (fromKv && Array.isArray(fromKv.recipients)) return fromKv
    } catch (error) {
      console.error("[admin-notify-recipients] KV read failed, falling back to file", error)
    }
  }

  try {
    const fromFile = await readJsonDataFile<AdminNotifyRecipientsSnapshot>(FILE_NAME, EMPTY_STORE)
    if (fromFile && Array.isArray(fromFile.recipients)) return fromFile
  } catch (error) {
    console.error("[admin-notify-recipients] file read failed", error)
  }

  return EMPTY_STORE
}

export async function writeAdminNotifyRecipients(snapshot: AdminNotifyRecipientsSnapshot) {
  if (hasKvRestConfig()) {
    try {
      const wrote = await kvRestSet(KV_KEY, JSON.stringify(snapshot))
      if (wrote) {
        await writeJsonDataFile(FILE_NAME, snapshot)
        return true
      }
    } catch (error) {
      console.error("[admin-notify-recipients] KV write failed, falling back to file", error)
    }
  }

  await writeJsonDataFile(FILE_NAME, snapshot)
  return true
}
