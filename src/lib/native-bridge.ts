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

export class NativeBridgeError extends Error {}

/**
 * اشتراک‌گذاری فایل از طریق شیت اشتراک اندروید (Share Sheet)
 * خروجی: 'shared' در صورت موفقیت یا لغو توسط کاربر، 'saved' اگر فایل ذخیره شد
 */
export async function nativeShareOrSaveFile(
  blob: Blob,
  filename: string
): Promise<'shared' | 'saved'> {
  const { Filesystem, Directory } = await import('@capacitor/filesystem')
  const base64 = await blobToBase64(blob)

  // فایل موقت در Cache برای اشتراک‌گذاری (با FileProvider)
  const cacheResult = await Filesystem.writeFile({
    path: filename,
    data: base64,
    directory: Directory.Cache,
    recursive: true,
  })

  try {
    const { Share } = await import('@capacitor/share')
    const can = await Share.canShare()
    if (can) {
      await Share.share({
        title: filename,
        files: [cacheResult.uri],
      })
      return 'shared' // کاربر اشتراک را انجام داد یا لغو کرد
    }
  } catch (e) {
    // لغو شیت اشتراک توسط کاربر = عملیات کامل شده
    if (e instanceof Error && e.message?.toLowerCase().includes('cancel')) return 'shared'
    // در غیر این صورت ادامه به ذخیره مستقیم
  }

  // ذخیره مستقیم در پوشه اسناد عمومی اندروید
  await Filesystem.writeFile({
    path: filename,
    data: base64,
    directory: Directory.Documents,
    recursive: true,
  })
  return 'saved'
}

/** ذخیره مستقیم فایل در پوشه اسناد اندروید — مسیر کامل برمی‌گردد */
export async function nativeSaveFile(blob: Blob, filename: string): Promise<string> {
  const { Filesystem, Directory } = await import('@capacitor/filesystem')
  const base64 = await blobToBase64(blob)
  const result = await Filesystem.writeFile({
    path: filename,
    data: base64,
    directory: Directory.Documents satisfies Directory,
    recursive: true,
  })
  return result.uri
}
