// فایبرکار — به‌روزرسانی درون‌برنامه‌ای از Releases گیت‌هاب (v1.3)
// جریان: بررسی نسخه (GitHub API) ← دانلود بومی APK به Cache ← باز کردن نصب‌کنندهٔ اندروید
// چون کلید امضا ثابت است، PackageManager در زمان نصب درجا به‌روزرسانی می‌کند و داده‌ها می‌مانند.
import { isNativeApp } from './native-bridge'
import { FiberUpdater } from '@/plugins/fiber-updater'

const REPO = 'parkerhell07-eng/fiberoptic'
const LATEST_API = `https://api.github.com/repos/${REPO}/releases/latest`

/** نسخهٔ جاری در وب (PWA) — در اپ اندروید از BuildConfig خوانده می‌شود */
export const APP_FALLBACK_VERSION = '1.3.0'

export interface UpdateCheckResult {
  available: boolean
  currentVersion: string
  latestVersion?: string
  apkUrl?: string
  notes?: string
  htmlUrl?: string
}

function normalizeVersion(v: string | undefined | null): string {
  return String(v ?? '')
    .trim()
    .replace(/^v/i, '')
}

/** مقایسهٔ عددی نسخه‌های نقطه‌ای (1.2.10 > 1.2.9) */
export function isNewerVersion(latest: string, current: string): boolean {
  const a = normalizeVersion(latest).split('.').map((x) => parseInt(x, 10) || 0)
  const b = normalizeVersion(current).split('.').map((x) => parseInt(x, 10) || 0)
  const len = Math.max(a.length, b.length)
  for (let i = 0; i < len; i++) {
    const x = a[i] ?? 0
    const y = b[i] ?? 0
    if (x !== y) return x > y
  }
  return false
}

/** نسخهٔ نصب‌شده — در اپ اندروید از BuildConfig، در وب مقدار ثابت */
export async function getCurrentVersion(): Promise<string> {
  if (isNativeApp()) {
    try {
      const { version } = await FiberUpdater.getVersion()
      return normalizeVersion(version)
    } catch {
      // پلاگین در دسترس نبود — ادامه با مقدار ثابت
    }
  }
  return APP_FALLBACK_VERSION
}

/** بررسی آخرین Release گیت‌هاب — در خطا پرتاب می‌کند (فراخواننده سکوت/پیام decides) */
export async function checkForUpdate(): Promise<UpdateCheckResult> {
  const currentVersion = await getCurrentVersion()
  const res = await fetch(LATEST_API, {
    headers: { Accept: 'application/vnd.github+json' },
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`بررسی نسخه ناموفق بود (کد ${res.status})`)
  const data = (await res.json()) as {
    tag_name?: string
    body?: string
    html_url?: string
    draft?: boolean
    assets?: Array<{ name?: string; browser_download_url?: string }>
  }
  if (data.draft) return { available: false, currentVersion }
  const latestVersion = normalizeVersion(data.tag_name)
  if (!latestVersion) throw new Error('نسخهٔ منتشرشده قابل خواندن نبود')
  const apk = (data.assets ?? []).find((a) => /release\.apk$/i.test(String(a?.name ?? '')))
  const apkUrl = apk?.browser_download_url
  const available = isNewerVersion(latestVersion, currentVersion) && !!apkUrl
  return {
    available,
    currentVersion,
    latestVersion,
    apkUrl,
    notes: data.body,
    htmlUrl: data.html_url,
  }
}

/**
 * دانلود بومی + باز کردن نصب‌کننده. onProgress درصد ۰..۱۰۰.
 * فقط در اپ اندروید؛ در وب خطا می‌دهد.
 */
export async function downloadAndInstallUpdate(
  apkUrl: string,
  onProgress?: (percent: number) => void
): Promise<void> {
  if (!isNativeApp()) {
    throw new Error('دانلود و نصب به‌روزرسانی فقط در نسخهٔ اندروید ممکن است')
  }
  const sub = await FiberUpdater.addListener('progress', (p) => onProgress?.(p.percent))
  try {
    const { path } = await FiberUpdater.downloadApk({ url: apkUrl })
    await FiberUpdater.installApk({ path })
  } finally {
    await sub.remove()
  }
}
