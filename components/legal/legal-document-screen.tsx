"use client"

import { ArrowLeft } from "lucide-react"
import { LegalMarkdown } from "@/components/legal/legal-markdown"

interface LegalDocumentScreenProps {
  title: string
  content: string
  onBack: () => void
}

export function LegalDocumentScreen({ title, content, onBack }: LegalDocumentScreenProps) {
  return (
    <div className="absolute inset-0 z-[85] flex flex-col bg-background">
      <header className="flex shrink-0 items-center gap-3 border-b border-border/60 px-4 py-3">
        <button
          type="button"
          onClick={onBack}
          aria-label="Назад"
          className="flex size-10 items-center justify-center rounded-full bg-card text-lg shadow-sm shadow-primary/5"
        >
          <ArrowLeft className="size-4" />
        </button>
        <h1 className="font-serif text-lg font-bold text-foreground">{title}</h1>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 pb-10">
        <LegalMarkdown content={content} />
      </div>
    </div>
  )
}
