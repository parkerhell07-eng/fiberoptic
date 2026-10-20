'use client'

// فایبرکار — کارت به‌روزرسانی درون‌برنامه‌ای (در منوی «بیشتر»)
// بررسی نسخه از Releases گیت‌هاب؛ دانلود بومی + نصب‌کنندهٔ اندروید در نسخهٔ APK.
// در وب (PWA) فقط «بررسی» معنا دارد و نصب با پیام راهنما رد می‌شود.
import * as React from 'react'
import { Download, Loader2, RefreshCw, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { isNativeApp } from '@/lib/native-bridge'
import { toFa } from '@/lib/persian'
import {
  checkForUpdate,
  downloadAndInstallUpdate,
  getCurrentVersion,
  type UpdateCheckResult,
} from '@/lib/updater'

/** نمایش نسخه با ارقام فارسی: 1.3.0 → ۱٫۳٫۰ */
export function faVersion(v: string | undefined | null): string {
  if (!v) return '—'
  return toFa(String(v).replace(/\./g, '٫'))
}

const LAST_CHECK_KEY = 'fiberkar.lastUpdateCheck'
const DAY_MS = 24 * 60 * 60 * 1000

type Phase =
  | { kind: 'idle' }
  | { kind: 'checking' }
  | { kind: 'latest'; version: string }
  | { kind: 'available'; result: UpdateCheckResult }
  | { kind: 'downloading'; percent: number }
  | { kind: 'installing' }
  | { kind: 'error'; message: string }

/** دانلود + نصب با اعلان پیشرفت — مشترک بین کارت و بررسی خودکار بوت */
export async function startUpdateFlow(apkUrl: string, latestVersion?: string): Promise<void> {
  const toastId = `fiberkar-update-${Date.now()}`
  toast.loading('در حال دانلود نسخهٔ جدید…', {
    id: toastId,
    description: '۰٪',
    duration: Infinity,
  })
  try {
    await downloadAndInstallUpdate(apkUrl, (percent) => {
      toast.loading('در حال دانلود نسخهٔ جدید…', {
        id: toastId,
        description: `${toFa(percent)}٪`,
        duration: Infinity,
      })
    })
    toast.loading('آمادهٔ نصب…', { id: toastId, description: 'نصب‌کنندهٔ اندروید باز می‌شود', duration: 8000 })
    toast.success('نصب‌کنندهٔ اندروید باز شد', {
      id: toastId,
      description: latestVersion
        ? `نسخهٔ ${faVersion(latestVersion)} — برای تکمیل، «نصب» را تأیید کنید`
        : 'برای تکمیل، «نصب» را تأیید کنید',
      duration: 10000,
    })
  } catch (e) {
    toast.error('به‌روزرسانی ناموفق بود', {
      id: toastId,
      description: (e as Error)?.message ?? 'خطای ناشناخته',
      duration: 8000,
    })
  }
}

/**
 * بررسی خودکار خاموش هنگام بوت — فقط در اپ اندروید و حداکثر روزی یک‌بار.
 * هر خطا (مثلاً آفلاین) بدون هیچ سر و صدایی نادیده گرفته می‌شود.
 */
export async function silentUpdateCheck(): Promise<void> {
  if (!isNativeApp() || typeof window === 'undefined') return
  try {
    const last = Number(window.localStorage.getItem(LAST_CHECK_KEY) ?? 0)
    if (Number.isFinite(last) && last > 0 && Date.now() - last < DAY_MS) return
    window.localStorage.setItem(LAST_CHECK_KEY, String(Date.now()))
    const result = await checkForUpdate()
    if (result.available && result.apkUrl) {
      toast.info(`نسخهٔ جدید فیبرکار (${faVersion(result.latestVersion)}) منتشر شده`, {
        description: 'از منوی «بیشتر» یا دکمهٔ زیر می‌توانید نصب کنید',
        duration: 15000,
        action: {
          label: 'دانلود و نصب',
          onClick: () => void startUpdateFlow(result.apkUrl!, result.latestVersion),
        },
      })
    }
  } catch {
    // آفلاین/خطای شبکه — سکوت کامل
  }
}

export default function UpdateChecker() {
  const [phase, setPhase] = React.useState<Phase>({ kind: 'idle' })
  const [current, setCurrent] = React.useState<string>('')

  React.useEffect(() => {
    let alive = true
    getCurrentVersion()
      .then((v) => {
        if (alive) setCurrent(v)
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [])

  async function handleCheck() {
    setPhase({ kind: 'checking' })
    try {
      const result = await checkForUpdate()
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(LAST_CHECK_KEY, String(Date.now()))
      }
      if (result.available) {
        setPhase({ kind: 'available', result })
      } else {
        setPhase({ kind: 'latest', version: result.latestVersion ?? result.currentVersion })
      }
    } catch (e) {
      setPhase({ kind: 'error', message: (e as Error)?.message ?? 'خطای ناشناخته' })
    }
  }

  async function handleInstall(result: UpdateCheckResult) {
    if (!result.apkUrl) return
    setPhase({ kind: 'downloading', percent: 0 })
    try {
      await downloadAndInstallUpdate(result.apkUrl, (percent) => {
        setPhase({ kind: 'downloading', percent })
      })
      setPhase({ kind: 'installing' })
      toast.success('نصب‌کنندهٔ اندروید باز شد', {
        description: 'برای تکمیل به‌روزرسانی، «نصب» را تأیید کنید (داده‌ها حفظ می‌شود)',
        duration: 10000,
      })
    } catch (e) {
      setPhase({ kind: 'error', message: (e as Error)?.message ?? 'خطای ناشناخته' })
    }
  }

  const native = isNativeApp()

  return (
    <div className="rounded-xl border bg-card p-3" data-testid="update-checker">
      <div className="flex items-center gap-2">
        <ShieldCheck className="size-4 shrink-0 text-primary" />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold">به‌روزرسانی برنامه</div>
          <div className="mt-0.5 text-xs text-muted-foreground">
            نسخهٔ فعلی: <span className="font-medium text-foreground">{faVersion(current || undefined)}</span>
            {!native ? ' — بررسی فعال است؛ نصب فقط در نسخهٔ اندروید' : ' — بررسی خودکار از گیت‌هاب'}
          </div>
        </div>
      </div>

      <div className="mt-3">
        {phase.kind === 'idle' || phase.kind === 'latest' || phase.kind === 'error' ? (
          <div className="space-y-2">
            {phase.kind === 'latest' ? (
              <div className="text-xs text-muted-foreground">
                ✓ به‌روزترین نسخه را دارید (آخرین انتشار: {faVersion(phase.version)})
              </div>
            ) : null}
            {phase.kind === 'error' ? (
              <div className="text-xs text-destructive" role="alert">
                {phase.message}
              </div>
            ) : null}
            <Button variant="outline" size="sm" className="min-h-11 w-full" onClick={() => void handleCheck()}>
              <RefreshCw className="size-4" />
              بررسی به‌روزرسانی
            </Button>
          </div>
        ) : null}

        {phase.kind === 'checking' ? (
          <div className="flex min-h-11 items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            در حال بررسی نسخهٔ جدید…
          </div>
        ) : null}

        {phase.kind === 'available' ? (
          <div className="space-y-2">
            <div className="text-xs">
              نسخهٔ جدید <span className="font-bold text-primary">{faVersion(phase.result.latestVersion)}</span> در
              دسترس است
            </div>
            <Button size="sm" className="min-h-11 w-full" onClick={() => void handleInstall(phase.result)}>
              <Download className="size-4" />
              دانلود و نصب
            </Button>
          </div>
        ) : null}

        {phase.kind === 'downloading' ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>در حال دانلود…</span>
              <span className="font-medium">{toFa(phase.percent)}٪</span>
            </div>
            <Progress value={phase.percent} />
          </div>
        ) : null}

        {phase.kind === 'installing' ? (
          <div className="flex min-h-11 items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            نصب‌کننده باز شد — «نصب» را تأیید کنید
          </div>
        ) : null}
      </div>
    </div>
  )
}
