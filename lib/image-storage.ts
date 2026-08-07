const DEFAULT_MAX_EDGE = 960
const DEFAULT_QUALITY = 0.82
const DEFAULT_MAX_BYTES = 280_000

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === "string") resolve(reader.result)
      else reject(new Error("Не удалось прочитать файл"))
    }
    reader.onerror = () => reject(reader.error ?? new Error("Не удалось прочитать файл"))
    reader.readAsDataURL(file)
  })
}

function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error("Не удалось прочитать фото"))
    }
    img.src = url
  })
}

function encodeCanvasToJpegDataUrl(
  canvas: HTMLCanvasElement,
  maxBytes: number,
  initialQuality: number,
): string {
  let quality = initialQuality
  let dataUrl = canvas.toDataURL("image/jpeg", quality)
  const maxEncodedLength = Math.round(maxBytes * 1.37)

  while (dataUrl.length > maxEncodedLength && quality > 0.45) {
    quality -= 0.08
    dataUrl = canvas.toDataURL("image/jpeg", quality)
  }

  return dataUrl
}

function drawScaledImage(
  source: CanvasImageSource,
  width: number,
  height: number,
): string {
  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("Не удалось обработать фото")

  ctx.drawImage(source, 0, 0, width, height)
  return encodeCanvasToJpegDataUrl(canvas, DEFAULT_MAX_BYTES, DEFAULT_QUALITY)
}

function getScaledDimensions(width: number, height: number, maxEdge: number) {
  const scale = Math.min(1, maxEdge / width, maxEdge / height)
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  }
}

async function compressWithBitmap(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file)
  try {
    const { width, height } = getScaledDimensions(
      bitmap.width,
      bitmap.height,
      DEFAULT_MAX_EDGE,
    )
    return drawScaledImage(bitmap, width, height)
  } finally {
    bitmap.close()
  }
}

async function compressWithImageElement(file: File): Promise<string> {
  const img = await loadImageFromFile(file)
  const { width, height } = getScaledDimensions(img.naturalWidth, img.naturalHeight, DEFAULT_MAX_EDGE)
  return drawScaledImage(img, width, height)
}

/** Compress goal cover photos before storing them in localStorage. */
export async function readImageFileForStorage(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Нужен файл изображения")
  }

  if (file.size <= 120_000) {
    const dataUrl = await readFileAsDataUrl(file)
    if (dataUrl.length <= DEFAULT_MAX_BYTES * 1.37) {
      return dataUrl
    }
  }

  if (typeof createImageBitmap === "function") {
    try {
      return await compressWithBitmap(file)
    } catch {
      // Fall back to HTMLImageElement for formats like HEIC on older WebViews.
    }
  }

  return compressWithImageElement(file)
}
