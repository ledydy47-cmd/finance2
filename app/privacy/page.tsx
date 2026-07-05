import Link from "next/link"
import { LegalMarkdown } from "@/components/legal/legal-markdown"
import { readLegalDocument } from "@/lib/legal-server"

export default function PrivacyPage() {
  const content = readLegalDocument("privacy.md")

  return (
    <main className="mx-auto min-h-dvh max-w-lg bg-background px-5 py-6 pb-10">
      <Link
        href="/"
        className="mb-4 inline-flex text-sm font-semibold text-primary underline-offset-2 hover:underline"
      >
        ← В приложение
      </Link>
      <LegalMarkdown content={content} />
    </main>
  )
}
