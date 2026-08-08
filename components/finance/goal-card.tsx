import Image from "next/image"
import { Camera, Plus } from "lucide-react"
import { ImagePickerTrigger } from "@/components/ui/image-picker-trigger"

import { formatMoney, type AppCurrency } from "@/lib/currency"

interface GoalCardProps {
  name: string
  saved: number
  target: number
  image: string
  currency: AppCurrency
  isPrimary?: boolean
  completed?: boolean
  onAdd?: () => void
  onImageChange?: (file: File) => void
}

export function GoalCard({
  name,
  saved,
  target,
  image,
  currency,
  isPrimary,
  completed,
  onAdd,
  onImageChange,
}: GoalCardProps) {
  const percent = target > 0 ? Math.min(100, Math.round((saved / target) * 100)) : 100
  const isDataUrl = image.startsWith("data:")

  return (
    <div className="overflow-hidden rounded-block bg-card shadow-sm shadow-primary/10">
      <div className="relative m-3 h-36 overflow-hidden rounded-block-inner">
        {isDataUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image} alt={`Фото цели: ${name}`} className="size-full object-cover" />
        ) : (
          <Image
            src={image || "/placeholder.svg"}
            alt={`Фото цели: ${name}`}
            fill
            sizes="(max-width: 420px) 100vw, 420px"
            className="object-cover"
            priority
          />
        )}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-gradient-to-t from-foreground/25 to-transparent"
        />
        {isPrimary && !completed && (
          <span className="absolute left-3 top-3 rounded-full bg-primary px-2.5 py-1 text-[10px] font-bold text-primary-foreground">
            Основная
          </span>
        )}
        {completed && (
          <span className="absolute left-3 top-3 rounded-full bg-[color:var(--success)] px-2.5 py-1 text-[10px] font-bold text-white">
            Достигнута ✨
          </span>
        )}
        {!completed && onImageChange && (
        <ImagePickerTrigger
          ariaLabel="Изменить фото цели"
          className="absolute bottom-3 right-3 flex size-9 cursor-pointer items-center justify-center rounded-full bg-card/85 text-foreground/80 shadow-sm backdrop-blur-sm transition-transform active:scale-95"
          onPick={onImageChange}
        >
          <Camera className="size-4" strokeWidth={2.2} />
        </ImagePickerTrigger>
        )}
      </div>

      <div className="px-5 pb-5">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="font-serif text-lg font-bold text-card-foreground text-balance">{name}</h3>
          <span className="shrink-0 rounded-full bg-accent px-2.5 py-1 text-xs font-bold text-accent-foreground">
            {percent}%
          </span>
        </div>

        <p className="mt-1 text-sm font-medium text-muted-foreground">
          <span className="text-card-foreground">{formatMoney(saved, currency)}</span>
          {" из "}
          {formatMoney(target, currency)}
        </p>

        <div className="mt-3 h-3 w-full overflow-hidden rounded-full bg-secondary">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${percent}%` }}
          />
        </div>

        {!completed && (
        <button
          type="button"
          onClick={onAdd}
          className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-block-sm bg-primary py-3 text-sm font-bold text-primary-foreground shadow-sm shadow-primary/30 transition-transform active:scale-[0.98]"
        >
          <Plus className="size-4" strokeWidth={2.8} />
          Добавить
        </button>
        )}
      </div>
    </div>
  )
}
