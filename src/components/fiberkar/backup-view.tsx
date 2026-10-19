'use client'

// فایبرکار — پشتیبان‌گیری و بازیابی (کاملاً محلی و آفلاین)
// جریان: وضعیت داده‌ها → تهیه پشتیبان → بررسی سلامت → بازیابی با تأیید دومرحله‌ای → منطقه خطر
import * as React from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { toast } from 'sonner'
import {
  AlertTriangle,
  Box as BoxIcon,
  Cable,
  CheckCircle2,
  ClipboardList,
  Database,
  FileUp,
  FolderKanban,
  Gauge,
  GitMerge,
  HardDrive,
  HardDriveDownload,
  History,
  Image as ImageIcon,
  Info,
  Loader2,
  RotateCcw,
  Route as RouteIcon,
  ShieldCheck,
  Trash2,
  UserRound,
  Zap,
} from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { ConfirmDialog, InfoRow, PageHeader, StatCard } from '@/components/fiberkar/primitives'
import {
  backupFileName,
  createBackupBlob,
  restoreBackup,
  saveBlobToDisk,
  verifyBackupBlob,
  type VerifyResult,
} from '@/lib/backup'
import { db, getLastBackupInfo, resetAllData } from '@/lib/localdb'
import { formatBytes, formatJalaliDateTime, toFa } from '@/lib/persian'
import { viewTitles } from '@/lib/labels'
import { useAppStore } from '@/store/app-store'

// برچسب فارسی جدول‌ها (هم‌نام با BACKUP_TABLES)
const TABLE_LABELS: Record<string, string> = {
  projects: 'پروژه‌ها',
  routes: 'مسیرها',
  boxes: 'باکس‌ها',
  operations: 'عملیات',
  fusions: 'فیوژن‌ها',
  powerTests: 'تست توان',
  dropCables: 'دراپ‌کابل',
  profiles: 'پروفایل‌ها',
  photos: 'عکس‌ها',
}

type RestoreMode = 'replace' | 'merge'

/** خلاصه یک‌خطی شمارش رکوردها */
function countsSummary(counts?: Record<string, number>): string {
  if (!counts) return ''
  return Object.entries(counts)
    .map(([k, n]) => `${TABLE_LABELS[k] ?? k} ${toFa(n)}`)
    .join(' · ')
}

function sumCounts(rec: Record<string, number>): number {
  return Object.values(rec).reduce((a, b) => a + b, 0)
}

export default function BackupView() {
  const back = useAppStore((s) => s.back)

  // ---------- ۱) وضعیت داده‌های فعلی (زنده) ----------
  const counts = useLiveQuery(async () => {
    const [projects, routes, boxes, operations, fusions, powerTests, dropCables, profiles, photos] =
      await Promise.all([
        db.projects.count(),
        db.routes.count(),
        db.boxes.count(),
        db.operations.count(),
        db.fusions.count(),
        db.powerTests.count(),
        db.dropCables.count(),
        db.profiles.count(),
        db.photos.count(),
      ])
    let photoBytes = 0
    await db.photos.each((p) => {
      photoBytes += p.size || 0
    })
    return { projects, routes, boxes, operations, fusions, powerTests, dropCables, profiles, photos, photoBytes }
  }, [])

  // ---------- ۲) آخرین پشتیبان ----------
  const lastBackup = useLiveQuery(() => getLastBackupInfo(), [])

  // ---------- ۳) تهیه پشتیبان جدید ----------
  const [creating, setCreating] = React.useState(false)
  async function handleCreateBackup() {
    setCreating(true)
    try {
      const { blob, info } = await createBackupBlob()
      const how = await saveBlobToDisk(blob, backupFileName())
      toast.success(`پشتیبان ذخیره شد (${formatBytes(info.size)})`, {
        description: how === 'picker' ? 'فایل در محل انتخابی شما ذخیره شد' : 'فایل در حافظه دستگاه ذخیره شد (پوشه اسناد یا دانلودها)',
      })
    } catch (e) {
      if ((e as Error)?.name === 'AbortError') {
        toast.info('ذخیره فایل لغو شد', {
          description: 'پشتیبان ساخته شد اما محل ذخیره انتخاب نشد؛ می‌توانید دوباره تلاش کنید',
        })
      } else {
        toast.error('تهیه پشتیبان ناموفق بود', {
          description: (e as Error)?.message || 'خطای ناشناخته',
        })
      }
    } finally {
      setCreating(false)
    }
  }

  // ---------- ۴) بررسی سلامت فایل ----------
  const verifyInputRef = React.useRef<HTMLInputElement>(null)
  const [verifying, setVerifying] = React.useState(false)
  const [verifyFileName, setVerifyFileName] = React.useState('')
  const [verifyResult, setVerifyResult] = React.useState<VerifyResult | null>(null)

  async function handleVerifyFile(file: File) {
    setVerifyFileName(file.name)
    setVerifying(true)
    setVerifyResult(null)
    try {
      const res = await verifyBackupBlob(file)
      setVerifyResult(res)
    } catch {
      setVerifyResult({ ok: false, error: 'بررسی فایل ممکن نشد' })
    } finally {
      setVerifying(false)
    }
  }

  // ---------- ۵) بازیابی (با تأیید دومرحله‌ای) ----------
  const restoreInputRef = React.useRef<HTMLInputElement>(null)
  const [restoreFile, setRestoreFile] = React.useState<File | null>(null)
  const [restoreVerify, setRestoreVerify] = React.useState<VerifyResult | null>(null)
  const [restoreChecking, setRestoreChecking] = React.useState(false)
  const [modeDialogOpen, setModeDialogOpen] = React.useState(false)
  const [pendingMode, setPendingMode] = React.useState<RestoreMode | null>(null)
  const [confirmOpen, setConfirmOpen] = React.useState(false)
  const [restoring, setRestoring] = React.useState(false)

  async function handleRestoreFile(file: File) {
    setRestoreChecking(true)
    setRestoreFile(file)
    setRestoreVerify(null)
    try {
      const res = await verifyBackupBlob(file)
      setRestoreVerify(res)
      if (res.ok) setModeDialogOpen(true) // فایل سالم است → انتخاب حالت
    } catch {
      setRestoreVerify({ ok: false, error: 'بررسی فایل ممکن نشد' })
    } finally {
      setRestoreChecking(false)
    }
  }

  function chooseMode(mode: RestoreMode) {
    setPendingMode(mode)
    setModeDialogOpen(false)
    setConfirmOpen(true)
  }

  async function handleRestore() {
    if (!restoreFile || !pendingMode) return
    setRestoring(true)
    try {
      const res = await restoreBackup(restoreFile, pendingMode)
      const totalRestored = sumCounts(res.restored)
      const totalSkipped = sumCounts(res.skipped)
      const perTable = Object.entries(res.restored)
        .filter(([, n]) => n > 0)
        .map(([k, n]) => `${TABLE_LABELS[k] ?? k} ${toFa(n)}`)
        .join(' · ')
      if (totalRestored === 0) {
        toast.warning('هیچ رکوردی بازیابی نشد', {
          description:
            totalSkipped > 0
              ? `${toFa(totalSkipped)} رکورد تکراری یا ناسازگار رد شد${perTable ? ` — ${perTable}` : ''}`
              : 'فایل پشتیبان رکورد قابل افزودنی نداشت',
        })
      } else {
        toast.success(`بازیابی انجام شد (${res.mode === 'replace' ? 'جایگزینی کامل' : 'ادغام'})`, {
          description: `${toFa(totalRestored)} رکورد بازیابی، ${toFa(totalSkipped)} رکورد رد شد${perTable ? ` — ${perTable}` : ''}`,
        })
      }
      setConfirmOpen(false)
      setPendingMode(null)
      setRestoreFile(null)
      setRestoreVerify(null)
      if (restoreInputRef.current) restoreInputRef.current.value = ''
    } catch (e) {
      toast.error('بازیابی ناموفق بود', { description: (e as Error)?.message || 'خطای ناشناخته' })
      setConfirmOpen(false)
    } finally {
      setRestoring(false)
    }
  }

  // ---------- ۶) منطقه خطر: پاک‌سازی کامل ----------
  const [wipeStage, setWipeStage] = React.useState<1 | 2 | null>(null)
  const [wiping, setWiping] = React.useState(false)

  async function handleWipe() {
    setWiping(true)
    try {
      await resetAllData()
      toast.success('تمام داده‌ها پاک شد', {
        description: 'همه پروژه‌ها، عملیات، عکس‌ها و پروفایل‌ها حذف شدند',
      })
      setWipeStage(null)
    } catch (e) {
      toast.error('پاک‌سازی ناموفق بود', { description: (e as Error)?.message || 'خطای ناشناخته' })
    } finally {
      setWiping(false)
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader title={viewTitles.backup} subtitle="ذخیره و بازیابی کامل داده‌ها روی همین دستگاه" onBack={back} />

      {/* ۱) وضعیت داده‌های فعلی */}
      <section className="rounded-xl border bg-card p-4" aria-label="وضعیت داده‌های فعلی">
        <div className="mb-3 flex items-center gap-2">
          <Database className="size-4 text-primary" aria-hidden />
          <h2 className="text-sm font-semibold">وضعیت داده‌های فعلی</h2>
        </div>
        {counts === undefined ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-20 rounded-xl" />
            ))}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <StatCard label="پروژه‌ها" value={toFa(counts.projects)} icon={<FolderKanban className="size-4" />} />
              <StatCard label="مسیرها" value={toFa(counts.routes)} icon={<RouteIcon className="size-4" />} />
              <StatCard label="باکس‌ها" value={toFa(counts.boxes)} icon={<BoxIcon className="size-4" />} />
              <StatCard label="عملیات" value={toFa(counts.operations)} icon={<ClipboardList className="size-4" />} />
              <StatCard label="فیوژن‌ها" value={toFa(counts.fusions)} icon={<Zap className="size-4" />} />
              <StatCard label="تست توان" value={toFa(counts.powerTests)} icon={<Gauge className="size-4" />} />
              <StatCard label="دراپ‌کابل" value={toFa(counts.dropCables)} icon={<Cable className="size-4" />} />
              <StatCard label="پروفایل‌ها" value={toFa(counts.profiles)} icon={<UserRound className="size-4" />} />
              <StatCard label="عکس‌ها" value={toFa(counts.photos)} icon={<ImageIcon className="size-4" />} />
              <StatCard
                label="حجم عکس‌ها"
                value={formatBytes(counts.photoBytes)}
                icon={<HardDrive className="size-4" />}
                tone="amber"
              />
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              این داده‌ها فقط در حافظه همین دستگاه (آفلاین) نگه‌داری می‌شوند؛ تهیه پشتیبان دوره‌ای توصیه می‌شود.
            </p>
          </>
        )}
      </section>

      {/* ۲) آخرین پشتیبان */}
      <section className="rounded-xl border bg-card p-4" aria-label="آخرین پشتیبان">
        <div className="mb-3 flex items-center gap-2">
          <History className="size-4 text-primary" aria-hidden />
          <h2 className="text-sm font-semibold">آخرین پشتیبان</h2>
        </div>
        {lastBackup === undefined ? (
          <Skeleton className="h-24 rounded-xl" />
        ) : lastBackup === null ? (
          <p className="text-sm text-muted-foreground">هنوز پشتیبانی تهیه نشده است.</p>
        ) : (
          <div>
            <InfoRow label="زمان" value={formatJalaliDateTime(lastBackup.time)} />
            <InfoRow label="حجم فایل" value={formatBytes(lastBackup.size)} />
            <InfoRow
              label="اثر انگشت (SHA-256)"
              value={
                <span dir="ltr" className="font-mono text-xs">
                  {lastBackup.checksum.slice(0, 10)}…
                </span>
              }
            />
            <div className="pt-3">
              <span className="text-sm text-muted-foreground">تعداد رکوردها:</span>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {Object.entries(lastBackup.counts).map(([k, n]) => (
                  <span key={k} className="rounded-md bg-muted px-2 py-0.5 text-xs tabular-nums">
                    {TABLE_LABELS[k] ?? k}: {toFa(n)}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}
      </section>

      {/* ۳) تهیه پشتیبان جدید */}
      <section className="rounded-xl border bg-card p-4" aria-label="تهیه پشتیبان جدید">
        <div className="mb-3 flex items-center gap-2">
          <ShieldCheck className="size-4 text-primary" aria-hidden />
          <h2 className="text-sm font-semibold">تهیه پشتیبان جدید</h2>
        </div>
        <Button onClick={() => void handleCreateBackup()} disabled={creating} className="min-h-12 w-full text-base">
          {creating ? <Loader2 className="size-5 animate-spin" aria-hidden /> : <HardDriveDownload className="size-5" aria-hidden />}
          {creating ? 'در حال تهیه پشتیبان…' : 'تهیه و ذخیره پشتیبان'}
        </Button>
        <p className="mt-2 flex items-start gap-1.5 text-xs text-muted-foreground">
          <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          فایل شامل تمام داده‌ها و عکس‌هاست؛ آن را در محل امن نگه دارید.
        </p>
      </section>

      {/* ۴) بررسی سلامت فایل پشتیبان */}
      <section className="rounded-xl border bg-card p-4" aria-label="بررسی سلامت فایل پشتیبان">
        <div className="mb-3 flex items-center gap-2">
          <FileUp className="size-4 text-primary" aria-hidden />
          <h2 className="text-sm font-semibold">بررسی سلامت فایل پشتیبان</h2>
        </div>
        <input
          ref={verifyInputRef}
          type="file"
          accept=".json,application/json"
          className="hidden"
          aria-label="انتخاب فایل پشتیبان برای بررسی"
          onChange={(e) => {
            const f = e.target.files?.[0]
            e.target.value = ''
            if (f) void handleVerifyFile(f)
          }}
        />
        <Button
          variant="outline"
          className="min-h-11 w-full"
          disabled={verifying}
          onClick={() => verifyInputRef.current?.click()}
        >
          {verifying ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <FileUp className="size-4" aria-hidden />}
          {verifying ? 'در حال بررسی فایل…' : 'انتخاب فایل پشتیبان'}
        </Button>
        {verifyResult &&
          (verifyResult.ok ? (
            <Alert className="mt-3 border-emerald-600/40 bg-emerald-500/10 text-emerald-900 dark:text-emerald-200 [&>svg]:text-emerald-700 dark:[&>svg]:text-emerald-300">
              <CheckCircle2 className="size-4" />
              <AlertTitle>فایل سالم است{verifyFileName ? ` — ${verifyFileName}` : ''}</AlertTitle>
              <AlertDescription>
                <span>نسخه: {toFa(`v${verifyResult.version ?? '—'}`)}</span>
                <span>تاریخ ایجاد: {formatJalaliDateTime(verifyResult.createdAt)}</span>
                {verifyResult.counts && <span>محتوا: {countsSummary(verifyResult.counts)}</span>}
              </AlertDescription>
            </Alert>
          ) : (
            <Alert variant="destructive" className="mt-3">
              <AlertTriangle className="size-4" />
              <AlertTitle>فایل پشتیبان معتبر نیست{verifyFileName ? ` — ${verifyFileName}` : ''}</AlertTitle>
              <AlertDescription>{verifyResult.error}</AlertDescription>
            </Alert>
          ))}
      </section>

      {/* ۵) بازیابی */}
      <section className="rounded-xl border bg-card p-4" aria-label="بازیابی از فایل پشتیبان">
        <div className="mb-3 flex items-center gap-2">
          <RotateCcw className="size-4 text-primary" aria-hidden />
          <h2 className="text-sm font-semibold">بازیابی از فایل پشتیبان</h2>
        </div>
        <input
          ref={restoreInputRef}
          type="file"
          accept=".json,application/json"
          className="hidden"
          aria-label="انتخاب فایل پشتیبان برای بازیابی"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) void handleRestoreFile(f)
          }}
        />
        <Button
          variant="outline"
          className="min-h-11 w-full"
          disabled={restoreChecking}
          onClick={() => restoreInputRef.current?.click()}
        >
          {restoreChecking ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <FileUp className="size-4" aria-hidden />}
          {restoreChecking ? 'در حال بررسی فایل…' : 'انتخاب فایل برای بازیابی'}
        </Button>
        {restoreVerify && !restoreVerify.ok && (
          <Alert variant="destructive" className="mt-3">
            <AlertTriangle className="size-4" />
            <AlertTitle>این فایل قابل بازیابی نیست</AlertTitle>
            <AlertDescription>{restoreVerify.error}</AlertDescription>
          </Alert>
        )}
        {restoreVerify?.ok && (
          <div className="mt-3 rounded-xl border border-emerald-600/40 bg-emerald-500/10 p-3 text-sm text-emerald-900 dark:text-emerald-200">
            <div className="flex items-center gap-2 font-semibold">
              <CheckCircle2 className="size-4" aria-hidden />
              فایل سالم است و آماده بازیابی است
            </div>
            <div className="mt-1.5 text-xs leading-6">
              نسخه: {toFa(`v${restoreVerify.version ?? '—'}`)}
              {restoreVerify.counts ? ` — ${countsSummary(restoreVerify.counts)}` : ''}
            </div>
            <Button className="mt-3 min-h-11 w-full" onClick={() => setModeDialogOpen(true)}>
              انتخاب حالت بازیابی
            </Button>
          </div>
        )}
      </section>

      {/* ۶) منطقه خطر */}
      <section
        className="rounded-xl border border-destructive/60 bg-destructive/5 p-4"
        aria-label="منطقه خطر"
      >
        <div className="mb-3 flex items-center gap-2">
          <AlertTriangle className="size-4 text-destructive" aria-hidden />
          <h2 className="text-sm font-semibold text-destructive">منطقه خطر</h2>
        </div>
        <p className="mb-3 text-xs text-muted-foreground">
          پاک‌سازی کامل، همه داده‌ها و عکس‌های ثبت‌شده روی این دستگاه را برای همیشه حذف می‌کند. پیش از ادامه پشتیبان تهیه کنید.
        </p>
        <Button variant="destructive" className="min-h-11 w-full" onClick={() => setWipeStage(1)}>
          <Trash2 className="size-4" aria-hidden />
          پاک‌سازی کامل داده‌ها
        </Button>
      </section>

      {/* دیالوگ انتخاب حالت بازیابی */}
      <Dialog open={modeDialogOpen} onOpenChange={setModeDialogOpen}>
        <DialogContent className="max-w-sm" dir="rtl">
          <DialogHeader>
            <DialogTitle>انتخاب حالت بازیابی</DialogTitle>
            <DialogDescription>
              فایل پشتیبان سالم است. مشخص کنید داده‌ها چگونه بازیابی شوند:
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={() => chooseMode('merge')}
              className="rounded-xl border bg-card p-4 text-right transition-colors hover:bg-accent"
            >
              <span className="flex items-center gap-2 font-semibold">
                <GitMerge className="size-4 text-primary" aria-hidden />
                ادغام با داده‌های فعلی
              </span>
              <span className="mt-1 block text-xs text-muted-foreground">
                ادغام: فقط رکوردهای جدید اضافه می‌شوند؛ رکوردهای موجود تغییر نمی‌کنند.
              </span>
            </button>
            <button
              type="button"
              onClick={() => chooseMode('replace')}
              className="rounded-xl border border-destructive/50 bg-destructive/5 p-4 text-right transition-colors hover:bg-destructive/10"
            >
              <span className="flex items-center gap-2 font-semibold text-destructive">
                <AlertTriangle className="size-4" aria-hidden />
                جایگزینی کامل
              </span>
              <span className="mt-1 block text-xs text-muted-foreground">
                جایگزینی کامل: همه داده‌های فعلی پاک و با پشتیبان جایگزین می‌شود. بازگشت‌پذیر نیست.
              </span>
            </button>
          </div>
          <DialogFooter className="flex-row justify-start gap-2">
            <Button variant="outline" className="min-h-11 flex-1" onClick={() => setModeDialogOpen(false)}>
              انصراف
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* تأیید دومرحله‌ای بازیابی — ادغام */}
      <ConfirmDialog
        open={confirmOpen && pendingMode === 'merge'}
        onOpenChange={(o) => {
          if (!o) {
            setConfirmOpen(false)
            setPendingMode(null)
          }
        }}
        title="تأیید ادغام"
        description="رکوردهای جدید از فایل پشتیبان به داده‌های فعلی اضافه می‌شوند. رکوردهای تکراری (شناسه یکسان) رد می‌شوند و داده‌های فعلی حفظ می‌شوند."
        confirmLabel="ادغام کن"
        loading={restoring}
        onConfirm={() => void handleRestore()}
      />

      {/* تأیید دومرحله‌ای بازیابی — جایگزینی کامل */}
      <ConfirmDialog
        open={confirmOpen && pendingMode === 'replace'}
        onOpenChange={(o) => {
          if (!o) {
            setConfirmOpen(false)
            setPendingMode(null)
          }
        }}
        title="تأیید جایگزینی کامل"
        description="همه داده‌های فعلی پاک و با محتوای فایل پشتیبان جایگزین می‌شود. این عمل بازگشت‌پذیر نیست."
        confirmLabel="جایگزینی کامل"
        destructive
        loading={restoring}
        onConfirm={() => void handleRestore()}
      />

      {/* پاک‌سازی کامل — مرحله ۱: هشدار */}
      <ConfirmDialog
        open={wipeStage === 1}
        onOpenChange={(o) => {
          if (!o) setWipeStage(null)
        }}
        title="پاک‌سازی کامل داده‌ها"
        description="تمام داده‌ها و عکس‌ها حذف می‌شود. پیش از ادامه مطمئن شوید پشتیبان به‌روزی از داده‌های مهم دارید."
        confirmLabel="متوجه‌ام، ادامه"
        destructive
        onConfirm={() => setWipeStage(2)}
      />

      {/* پاک‌سازی کامل — مرحله ۲: تأیید نهایی */}
      <ConfirmDialog
        open={wipeStage === 2}
        onOpenChange={(o) => {
          if (!o) setWipeStage(null)
        }}
        title="تأیید نهایی پاک‌سازی"
        description="آیا مطمئن هستید؟ همه پروژه‌ها، مسیرها، باکس‌ها، عملیات، عکس‌ها و پروفایل‌ها برای همیشه حذف می‌شوند و بازگشت‌پذیر نیستند."
        confirmLabel="بله، همه‌چیز را پاک کن"
        destructive
        loading={wiping}
        onConfirm={() => void handleWipe()}
      />
    </div>
  )
}
