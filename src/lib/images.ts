// فایبرکار — پردازش تصاویر: فشرده‌سازی، بندانگشتی، تبدیل Blob/DataURL
// عکس‌ها در فضای اختصاصی اپ (IndexedDB) ذخیره می‌شوند و در گالری عمومی ظاهر نمی‌شوند.

export interface ProcessedImage {
  blob: Blob
  thumb: string // dataURL
  width: number
  height: number
}

/**
 * فشرده‌سازی و ساخت بندانگشتی.
 * maxDim: حداکثر بعد بزرگ عکس اصلی (کیفیت حفظ شود اما حجم کنترل شود)
 * thumbDim: بعد بندانگشتی برای لیست‌ها (مدیریت حافظه)
 */
export async function processImageFile(
  file: File | Blob,
  opts: { maxDim?: number; quality?: number; thumbDim?: number } = {}
): Promise<ProcessedImage> {
  const { maxDim = 2048, quality = 0.85, thumbDim = 480 } = opts

  const bitmap = await loadBitmap(file)
  const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height))
  const width = Math.max(1, Math.round(bitmap.width * scale))
  const height = Math.max(1, Math.round(bitmap.height * scale))

  const blob = await drawToBlob(bitmap, width, height, quality)

  // thumbDim = 0 → بدون بندانگشتی (مسیر PDF — جلوگیری از انکود دوم بی‌استفاده)
  let thumb = ''
  if (thumbDim > 0) {
    const tScale = Math.min(1, thumbDim / Math.max(width, height))
    const tW = Math.max(1, Math.round(width * tScale))
    const tH = Math.max(1, Math.round(height * tScale))
    thumb = await drawToDataUrl(bitmap, tW, tH, 0.75)
  }

  if (!(bitmap instanceof HTMLImageElement)) bitmap.close()
  return { blob, thumb, width, height }
}

async function loadBitmap(file: File | Blob): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === 'function') {
    try {
      // from-image → احترام به چرخش EXIF (عکس‌های چرخیده در برخی WebViewها)
      return await createImageBitmap(file, { imageOrientation: 'from-image' })
    } catch {
      try {
        return await createImageBitmap(file)
      } catch {
        // ادامه با fallback
      }
    }
  }
  const url = URL.createObjectURL(file)
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = () => reject(new Error('خواندن تصویر ممکن نشد'))
      img.src = url
    })
  } finally {
    // بعد از لود شدن image می‌توان URL را آزاد کرد؛ با تأخیر امن
    setTimeout(() => URL.revokeObjectURL(url), 5000)
  }
}

function drawToBlob(
  bitmap: ImageBitmap | HTMLImageElement,
  w: number,
  h: number,
  quality: number
): Promise<Blob> {
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('پردازش تصویر در این مرورگر پشتیبانی نمی‌شود')
  // پس‌زمینه سفید — PNGهای شفاف در JPEG سیاه نمیشوند
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, w, h)
  ctx.drawImage(bitmap as CanvasImageSource, 0, 0, w, h)
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('ذخیره تصویر ممکن نشد'))),
      'image/jpeg',
      quality
    )
  })
}

function drawToDataUrl(
  bitmap: ImageBitmap | HTMLImageElement,
  w: number,
  h: number,
  quality: number
): Promise<string> {
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('پردازش تصویر در این مرورگر پشتیبانی نمی‌شود')
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, w, h)
  ctx.drawImage(bitmap as CanvasImageSource, 0, 0, w, h)
  return Promise.resolve(canvas.toDataURL('image/jpeg', quality))
}

/** Blob → dataURL (برای PDF و پشتیبان) */
export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('خواندن فایل ممکن نشد'))
    reader.readAsDataURL(blob)
  })
}

/** dataURL → Blob (برای بازیابی پشتیبان) */
export async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const res = await fetch(dataUrl)
  return res.blob()
}

/** dataURL با ابعاد محدود برای گزارش PDF (مدیریت حافظه) — شکست یک عکس کل گزارش را نمی‌کشد */
export async function blobToReportDataUrl(blob: Blob, maxDim = 900, quality = 0.8): Promise<string> {
  try {
    const img: ProcessedImage = await processImageFile(blob, { maxDim, quality, thumbDim: 0 })
    return await blobToDataUrl(img.blob)
  } catch {
    return await blobToDataUrl(blob) // ممکن است پرتاب شود — فراخواننده هم try/catch دارد
  }
}

/** Object URL با مدیریت آزادسازی حافظه */
export function createObjectUrl(blob: Blob): string {
  return URL.createObjectURL(blob)
}

export function revokeObjectUrl(url: string | undefined | null): void {
  if (url) URL.revokeObjectURL(url)
}
