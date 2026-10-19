// پل ارتباطی با قابلیت‌های بومی اندروید (Capacitor)
// در وب عادی هیچ اثری ندارد؛ فقط وقتی اپ به‌صورت APK اجرا شود فعال می‌شود.
import type { Directory } from '@capacitor/filesystem'

interface CapacitorGlobal {
  isNativePlatform?: () => boolean
  getPlatform?: () => string
}

/** آیا اپ داخل پوسته اندروید (Capacitor) اجرا می‌شود؟ */
export function isNativeApp(): boolean {
  if (typeof window === 'undefined') return false
  const cap = (window as unknown as { Capacitor?: CapacitorGlobal }).Capacitor
  return typeof cap?.isNativePlatform === 'function' && cap.isNativePlatform()
}

/** تبدیل Blob به base64 خام (بدون پیشوند data:) */
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('خواندن فایل ناموفق بود'))
    reader.onloadend = () => {
      const result = reader.result as string
      resolve(result.includes(',') ? result.split(',')[1]! : result)
    }
    reader.readAsDataURL(blob)
  })
}

/**
 * پاک‌سازی نام فایل برای فایل‌سیستم اندروید و اهداف اشتراک.
 * حروف فارسی مجازند؛ کاراکترهای مسیرساز (/ \ : ? * " < > |) و کنترلی حذف می‌شوند.
 */
export function sanitizeFileName(name: string, fallbackExt = ''): string {
  const cleaned = String(name ?? '')
    .replace(/[\\/:*?"<>|\n\r\t]/g, '-')
    .replace(/\s+/g, ' ')
    .replace(/^[.\s-]+|[.\s-]+$/g, '')
    .slice(0, 80)
    .trim()
  const safe = cleaned.length > 0 ? cleaned : 'fiberkar-file'
  // اگر پسوند از دست رفته (مثلاً پس از پاک‌سازی) به آن بچسبان
  if (fallbackExt && !/\.[A-Za-z0-9]{1,6}$/.test(safe)) return `${safe}${fallbackExt}`
  return safe
}

export class NativeBridgeError extends Error {}

/**
 * اشتراک‌گذاری فایل از طریق شیت اشتراک اندروید (Share Sheet)
 * خروجی:
 *  - 'shared'  → شیت اشتراک باز شد و کاربر آن را تمام/لغو کرد
 *  - 'saved'   → فایل در پوشه اسناد ذخیره شد (وقتی اشتراک ممکن نبود)
 *  - 'failed'  → هر دو مسیر شکست خورد (فراخواننده باید خطا را نشان دهد)
 */
export async function nativeShareOrSaveFile(
  blob: Blob,
  filename: string
): Promise<'shared' | 'saved' | 'failed'> {
  const { Filesystem, Directory } = await import('@capacitor/filesystem')
  const safeName = sanitizeFileName(filename)
  const base64 = await blobToBase64(blob)

  // فایل موقت در Cache برای اشتراک‌گذاری (با FileProvider)
  const cacheResult = await Filesystem.writeFile({
    path: safeName,
    data: base64,
    directory: Directory.Cache,
    recursive: true,
  })

  try {
    const { Share } = await import('@capacitor/share')
    const can = await Share.canShare()
    if (can) {
      await Share.share({
        title: safeName,
        files: [cacheResult.uri],
      })
      return 'shared' // کاربر اشتراک را انجام داد یا لغو کرد
    }
  } catch (e) {
    // لغو شیت اشتراک توسط کاربر = عملیات کامل شده
    if (e instanceof Error && e.message?.toLowerCase().includes('cancel')) return 'shared'
    // در غیر این صورت ادامه به ذخیره مستقیم
  } finally {
    // فایل موقت کش همیشه پاک شود (حجم کش اپ رشد نکند)
    Filesystem.deleteFile({ path: safeName, directory: Directory.Cache }).catch(() => {})
  }

  // ذخیره مستقیم در پوشه اسناد عمومی اندروید
  try {
    await Filesystem.writeFile({
      path: safeName,
      data: base64,
      directory: Directory.Documents,
      recursive: true,
    })
    return 'saved'
  } catch {
    // اندروید ۱۰+ (scoped storage) ممکن است اجازه نوشتن مستقیم ندهد
    return 'failed'
  }
}

/** ذخیره مستقیم فایل در پوشه اسناد اندروید — مسیر کامل برمی‌گردد؛ در خطا پرتاب می‌کند */
export async function nativeSaveFile(blob: Blob, filename: string): Promise<string> {
  const { Filesystem, Directory } = await import('@capacitor/filesystem')
  const base64 = await blobToBase64(blob)
  const result = await Filesystem.writeFile({
    path: sanitizeFileName(filename),
    data: base64,
    directory: Directory.Documents satisfies Directory,
    recursive: true,
  })
  return result.uri
}
