function renderInline(text: string) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={index} className="font-semibold text-foreground">
          {part.slice(2, -2)}
        </strong>
      )
    }
    return part
  })
}

export function LegalMarkdown({ content }: { content: string }) {
  const blocks = content.split(/\n{2,}/)

  return (
    <div className="space-y-4 text-sm leading-relaxed text-foreground/90">
      {blocks.map((block, index) => {
        const trimmed = block.trim()
        if (!trimmed) return null

        if (trimmed.startsWith("# ")) {
          return (
            <h1 key={index} className="font-serif text-2xl font-bold text-foreground">
              {trimmed.slice(2)}
            </h1>
          )
        }

        if (trimmed.startsWith("## ")) {
          return (
            <h2 key={index} className="pt-2 font-serif text-lg font-bold text-foreground">
              {trimmed.slice(3)}
            </h2>
          )
        }

        if (/^\d+\.\d+\./.test(trimmed)) {
          return (
            <p key={index} className="text-sm leading-relaxed">
              {renderInline(trimmed)}
            </p>
          )
        }

        return (
          <p key={index} className="whitespace-pre-wrap text-sm leading-relaxed">
            {renderInline(trimmed)}
          </p>
        )
      })}
    </div>
  )
}
