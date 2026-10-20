// پلاگین بومی به‌روزرسانی فیبرکار (تعریف در android/.../FiberUpdaterPlugin.java)
// در وب هیچ‌کدام از متدها وجود ندارند — فراخوانی فقط وقتی isNativeApp() است.
import { registerPlugin } from '@capacitor/core'

export interface FiberUpdaterProgress {
  percent: number
  done: number
  total: number
}

export interface FiberUpdaterPlugin {
  /** نسخهٔ نصب‌شده از BuildConfig — منبع حقیقت واحد */
  getVersion(): Promise<{ version: string; versionCode: number }>
  /** دانلود APK به Cache اپ + رویدادهای progress */
  downloadApk(opts: { url: string }): Promise<{ path: string; size: number }>
  /** باز کردن نصب‌کنندهٔ اندروید روی فایل دانلودشده */
  installApk(opts: { path: string }): Promise<void>
  addListener(
    eventName: 'progress',
    listenerFunc: (data: FiberUpdaterProgress) => void
  ): Promise<{ remove: () => Promise<void> }> & { remove: () => Promise<void> }
}

export const FiberUpdater = registerPlugin<FiberUpdaterPlugin>('FiberUpdater')
