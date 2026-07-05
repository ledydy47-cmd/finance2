import { redirect } from "next/navigation"

export default async function PanelAliasPage({
  searchParams,
}: {
  searchParams: Promise<{ key?: string; tab?: string }>
}) {
  const params = await searchParams
  const query = new URLSearchParams()
  if (params.key) query.set("key", params.key)
  query.set("tab", params.tab ?? "stats")
  redirect(`/admin/support?${query.toString()}`)
}
