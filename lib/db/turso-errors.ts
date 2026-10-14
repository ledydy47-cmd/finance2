export function isTursoWriteBlockedError(error: unknown) {
  if (!error || typeof error !== "object") return false

  const err = error as { code?: string; message?: string; cause?: unknown }
  if (err.code === "BLOCKED") return true

  const message = `${err.message ?? ""} ${String(err.cause ?? "")}`.toLowerCase()
  return (
    message.includes("writes are blocked") ||
    message.includes("sql write operations are forbidden")
  )
}
