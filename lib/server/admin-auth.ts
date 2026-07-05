export function getAdminSupportSecret() {
  return process.env.ADMIN_SUPPORT_SECRET ?? process.env.CRON_SECRET ?? null
}

export function isAdminSupportAuthorized(request: Request) {
  const secret = getAdminSupportSecret()
  if (!secret) return false

  const header = request.headers.get("authorization")
  if (header === `Bearer ${secret}`) return true

  const url = new URL(request.url)
  return url.searchParams.get("key") === secret
}
