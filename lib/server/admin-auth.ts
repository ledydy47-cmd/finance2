export function getAdminSupportSecret() {
  return process.env.ADMIN_SUPPORT_SECRET ?? process.env.CRON_SECRET ?? null
}

function getAdminAuthSecrets() {
  return [process.env.ADMIN_SUPPORT_SECRET, process.env.CRON_SECRET].filter(
    (value, index, list): value is string =>
      Boolean(value) && list.indexOf(value) === index,
  )
}

export function isAdminSupportAuthorized(request: Request) {
  const secrets = getAdminAuthSecrets()
  if (secrets.length === 0) return false

  const header = request.headers.get("authorization")
  if (header?.startsWith("Bearer ")) {
    const token = header.slice("Bearer ".length)
    if (secrets.includes(token)) return true
  }

  const url = new URL(request.url)
  const key = url.searchParams.get("key")
  return Boolean(key && secrets.includes(key))
}
