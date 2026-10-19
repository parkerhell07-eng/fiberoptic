'use client'

// فایبرکار — داشبورد پیشرفته (آمار زنده، روند عملیات ۶ ماه، توزیع وضعیت، یادآور پشتیبان، سنجاق)
// همه داده‌ها واقعی و از IndexedDB — هیچ داده ساختگی وجود ندارد.
import * as React from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  Activity,
  Boxes,
  Cable,
  ClipboardList,
  DatabaseBackup,
  Download,
  FileDown,
  FolderKanban,
  FolderPlus,
  Gauge,
  Images,
  Info,
  Map as MapIcon,
  Pin,
  Ruler,
  Sparkles,
  Users,
  Waypoints,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Skeleton } from '@/components/ui/skeleton'
import {
  EmptyState,
  ItemCard,
  StatCard,
  StatusBadge,
} from '@/components/fiberkar/primitives'
import { buildAndSaveCsv, type CsvKind } from '@/components/fiberkar/csv-export-button'
import { useAppStore } from '@/store/app-store'
import { db, getDashboardStats, getLastBackupInfo } from '@/lib/localdb'
import { formatJalali, formatMeters, toFa } from '@/lib/persian'
import { cn } from '@/lib/utils'
import {
  operationStatusLabels,
  operationStatusVariants,
  operationTypeLabels,
  projectStatusLabels,
  projectStatusVariants,
} from '@/lib/labels'
import type { Operation, Project, ProjectStatus } from '@/lib/types'

const SHORTCUTS = [
  { label: 'پروژه جدید', icon: FolderPlus, view: 'projects' },
  { label: 'ثبت عملیات', icon: ClipboardList, view: 'operations' },
  { label: 'تست توان', icon: Gauge, view: 'power-tests' },
  { label: 'دراپ‌کابل', icon: Cable, view: 'drop-cables' },
  { label: 'گزارش PDF', icon: FileDown, view: 'reports' },
  { label: 'پشتیبان‌گیری', icon: DatabaseBackup, view: 'backup' },
] as const

const DAY_MS = 24 * 60 * 60 * 1000

/** نمودار میله‌ای روند عملیات (div خالص — بدون وابستگی جدید) */
function TrendChart({ data }: { data: Array<{ label: string; count: number }> }) {
  const max = Math.max(1, ...data.map((d) => d.count))
  const ariaLabel = `نمودار میله‌ای روند عملیات در ۶ ماه اخیر — ${data
    .map((d) => `${d.label}: ${toFa(d.count)} عملیات`)
    .join('، ')}`
  return (
    <div role="img" aria-label={ariaLabel} className="rounded-xl border bg-card p-4">
      <div className="flex items-end justify-between gap-2 sm:gap-4">
        {data.map((d) => {
          const pct = Math.round((d.count / max) * 100)
          return (
            <div key={d.label} className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
              <span className="text-xs font-bold tabular-nums">{toFa(d.count)}</span>
              <div className="flex h-24 w-full items-end sm:h-28" aria-hidden>
                <div
                  className={cn('w-full rounded-t-md bg-primary transition-all', d.count === 0 && 'opacity-25')}
                  style={{ height: `${d.count === 0 ? 2 : Math.max(6, pct)}%`, minHeight: '2px' }}
                />
              </div>
              <span className="max-w-full truncate text-[10px] text-muted-foreground sm:text-xs">{d.label}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/** توزیع وضعیت پروژه‌ها — نوار افقی رنگی مطابق واریانت بج‌ها */
function StatusDistribution({ data }: { data: Array<{ status: ProjectStatus; count: number }> }) {
  const max = Math.max(1, ...data.map((d) => d.count))
  const barClass: Record<'default' | 'secondary' | 'destructive' | 'outline', string> = {
    default: 'bg-primary',
    secondary: 'bg-secondary',
    destructive: 'bg-destructive',
    outline: 'bg-muted-foreground/40',
  }
  if (data.length === 0) {
    return (
      <p className="rounded-xl border border-dashed p-4 text-center text-sm text-muted-foreground">
        پروژه‌ای ثبت نشده است
      </p>
    )
  }
  return (
    <div className="space-y-3 rounded-xl border bg-card p-4" role="img" aria-label="توزیع وضعیت پروژه‌ها">
      {data.map(({ status, count }) => (
        <div key={status} className="flex items-center gap-2 sm:gap-3">
          <Badge variant={projectStatusVariants[status]} className="w-28 shrink-0 justify-center text-[11px] sm:w-32">
            {projectStatusLabels[status] ?? 'نامشخص'}
          </Badge>
          <div className="h-3 min-w-0 flex-1 overflow-hidden rounded-full bg-muted" aria-hidden>
            <div
              className={cn('h-full rounded-full', barClass[projectStatusVariants[status]])}
              style={{ width: `${Math.max(3, Math.round((count / max) * 100))}%` }}
            />
          </div>
          <span className="w-8 shrink-0 text-end text-sm font-bold tabular-nums">{toFa(count)}</span>
        </div>
      ))}
    </div>
  )
}

export default function DashboardView() {
  const navigate = useAppStore((s) => s.navigate)

  // آمار کلی — داده واقعی، بدون داده ساختگی
  const stats = useLiveQuery(() => getDashboardStats(), [])

  // اطلاعات آخرین پشتیبان (جدا از آمار) — برای یادآور پشتیبان‌گیری
  const lastBackup = useLiveQuery(() => getLastBackupInfo(), [])

  const recentProjects = useLiveQuery(async () => {
    const ps = await db.projects.filter((p) => !p.archived).toArray()
    // سنجاق‌شده‌ها اول، سپس جدیدترین
    return ps.sort((a, b) => (b.pinned ?? 0) - (a.pinned ?? 0) || b.createdAt - a.createdAt).slice(0, 5)
  }, [])

  const recentOperations = useLiveQuery(async () => {
    const ops = await db.operations.orderBy('createdAt').reverse().limit(5).toArray()
    return ops
  }, [])

  // تشخیص خالی‌بودن «واقعی» — شامل آرشیو؛ کاربر فقط‌آرشیوی هم نباید خالی می‌دید
  const hasNoData = stats !== undefined && stats.projectsTotalAll === 0

  // ---------- یادآور پشتیبان‌گیری ----------
  const backupReminder = React.useMemo(() => {
    if (lastBackup === undefined) return null // هنوز در حال بارگذاری
    if (lastBackup === null) return { kind: 'never' as const, days: 0 }
    const days = Math.floor((Date.now() - lastBackup.time) / DAY_MS)
    return days >= 7 ? { kind: 'stale' as const, days } : null
  }, [lastBackup])

  // ---------- خروجی CSV (همه داده‌ها) ----------
  const [exportingKind, setExportingKind] = React.useState<CsvKind | null>(null)
  async function handleExportCsv(kind: CsvKind) {
    if (exportingKind) return
    setExportingKind(kind)
    try {
      await buildAndSaveCsv(kind)
    } finally {
      setExportingKind(null)
    }
  }

  return (
    <div className="space-y-6">
      {/* عنوان */}
      <div>
        <h1 className="text-xl font-bold sm:text-2xl">داشبورد</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">نمای کلی کارهای فیبر نوری شما — همه داده‌ها فقط روی همین دستگاه</p>
      </div>

      {/* یادآور پشتیبان‌گیری */}
      {backupReminder && (
        <div
          role="status"
          className="flex flex-col gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-amber-900 dark:text-amber-200 sm:flex-row sm:items-center"
        >
          <span className="shrink-0 text-amber-600 dark:text-amber-300" aria-hidden>
            <Info className="size-5" />
          </span>
          <p className="min-w-0 flex-1 text-sm font-medium">
            {backupReminder.kind === 'never'
              ? 'هنوز پشتیبان‌گیری نکرده‌اید — داده‌ها فقط روی این دستگاه است'
              : `آخرین پشتیبان ${toFa(backupReminder.days)} روز پیش بوده است؛ یک پشتیبان تازه تهیه کنید`}
          </p>
          <Button size="sm" className="min-h-11 shrink-0 bg-amber-600 hover:bg-amber-700 sm:min-h-9" onClick={() => navigate('backup')}>
            <DatabaseBackup className="size-4" aria-hidden />
            پشتیبان‌گیری
          </Button>
        </div>
      )}

      {/* میان‌برهای سریع */}
      <section aria-label="میان‌برهای سریع">
        <h2 className="mb-3 text-sm font-semibold text-muted-foreground">میان‌برهای سریع</h2>
        <div className="grid grid-cols-3 gap-3">
          {SHORTCUTS.map((sc) => (
            <button
              key={sc.view}
              type="button"
              onClick={() => navigate(sc.view)}
              className="flex min-h-20 flex-col items-center justify-center gap-1.5 rounded-xl border bg-card p-2 text-xs font-medium transition-colors hover:bg-accent active:bg-accent"
            >
              <span className="text-primary">
                <sc.icon className="size-5" />
              </span>
              {sc.label}
            </button>
          ))}
        </div>
      </section>

      {/* آمار */}
      <section aria-label="آمار کلی">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-muted-foreground">آمار کلی</h2>
          {!hasNoData && (
            <DropdownMenu dir="rtl">
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="min-h-9 gap-1.5 text-xs" disabled={!!exportingKind}>
                  {exportingKind ? 'در حال ساخت…' : 'خروجی CSV'}
                  <Download className="size-3.5" aria-hidden />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem onClick={() => void handleExportCsv('operations')} disabled={!!exportingKind}>
                  <ClipboardList className="size-4" aria-hidden />
                  عملیات
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => void handleExportCsv('drop-cables')} disabled={!!exportingKind}>
                  <Cable className="size-4" aria-hidden />
                  دراپ‌کابل‌ها
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => void handleExportCsv('power-tests')} disabled={!!exportingKind}>
                  <Gauge className="size-4" aria-hidden />
                  تست‌های توان
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
        {stats === undefined ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-[76px] rounded-xl" />
            ))}
          </div>
        ) : hasNoData ? (
          <EmptyState
            icon={<FolderKanban className="size-10" />}
            title="هنوز پروژه‌ای ثبت نشده است"
            hint="برای شروع، نخستین پروژه خود را بسازید؛ سپس مسیرها، باکس‌ها و عملیات را زیر همان پروژه ثبت کنید. همه اطلاعات به‌صورت آفلاین روی همین دستگاه ذخیره می‌شود."
            actionLabel="پروژه جدید"
            onAction={() => navigate('projects')}
          />
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard label="پروژه‌ها" value={toFa(stats.projectsTotal)} icon={<FolderKanban className="size-4" />} onClick={() => navigate('projects')} tone="accent" />
            <StatCard label="در حال اجرا" value={toFa(stats.projectsActive)} icon={<Activity className="size-4" />} onClick={() => navigate('projects')} />
            <StatCard label="مسیرها" value={toFa(stats.routes)} icon={<Waypoints className="size-4" />} onClick={() => navigate('projects')} />
            <StatCard label="باکس‌ها" value={toFa(stats.boxes)} icon={<Boxes className="size-4" />} />
            <StatCard label="عملیات این ماه" value={toFa(stats.operationsThisMonth)} icon={<ClipboardList className="size-4" />} onClick={() => navigate('operations')} tone="accent" />
            <StatCard label="فیوژن‌ها" value={toFa(stats.fusions)} icon={<Sparkles className="size-4" />} onClick={() => navigate('fusion')} />
            <StatCard label="تست‌های توان" value={toFa(stats.powerTests)} icon={<Gauge className="size-4" />} onClick={() => navigate('power-tests')} />
            <StatCard label="دراپ‌کابل‌ها" value={toFa(stats.dropCables)} icon={<Cable className="size-4" />} onClick={() => navigate('drop-cables')} />
            <StatCard label="مجموع متراژ مصرفی" value={formatMeters(stats.consumedMetersTotal)} icon={<Ruler className="size-4" />} onClick={() => navigate('drop-cables')} tone="amber" />
            <StatCard label="عکس‌ها" value={toFa(stats.photoCount)} icon={<Images className="size-4" />} onClick={() => navigate('photos')} />
            <StatCard label="پروفایل‌ها" value={toFa(stats.profiles)} icon={<Users className="size-4" />} onClick={() => navigate('profiles')} />
          </div>
        )}
      </section>

      {/* روند عملیات ۶ ماه اخیر */}
      {!hasNoData && (
        <section aria-label="روند عملیات ۶ ماه اخیر">
          <h2 className="mb-3 text-sm font-semibold text-muted-foreground">روند عملیات (۶ ماه اخیر)</h2>
          {stats === undefined ? (
            <Skeleton className="h-44 rounded-xl" />
          ) : (
            <TrendChart data={stats.operationsByMonth} />
          )}
        </section>
      )}

      {/* توزیع وضعیت پروژه‌ها */}
      {!hasNoData && (
        <section aria-label="توزیع وضعیت پروژه‌ها">
          <h2 className="mb-3 text-sm font-semibold text-muted-foreground">توزیع وضعیت پروژه‌ها</h2>
          {stats === undefined ? (
            <Skeleton className="h-28 rounded-xl" />
          ) : (
            <StatusDistribution data={stats.projectStatusCounts} />
          )}
        </section>
      )}

      {/* آخرین پروژه‌ها */}
      {!hasNoData && (
        <section aria-label="آخرین پروژه‌ها">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-muted-foreground">آخرین پروژه‌ها</h2>
            <button
              type="button"
              onClick={() => navigate('projects')}
              className="text-xs font-medium text-primary hover:underline"
            >
              مشاهده همه
            </button>
          </div>
          {recentProjects === undefined ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-20 rounded-xl" />
              ))}
            </div>
          ) : recentProjects.length === 0 ? (
            <p className="rounded-xl border border-dashed p-4 text-center text-sm text-muted-foreground">پروژه‌ای ثبت نشده است</p>
          ) : (
            <div className="space-y-3">
              {recentProjects.map((p: Project) => (
                <ItemCard
                  key={p.id}
                  title={p.name}
                  badges={
                    <>
                      <StatusBadge label={projectStatusLabels[p.status] ?? 'نامشخص'} variant={projectStatusVariants[p.status]} />
                      {p.pinned === 1 && (
                        <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                          <Pin className="size-3" aria-hidden />
                          سنجاق‌شده
                        </span>
                      )}
                    </>
                  }
                  subtitle={[p.client, p.area].filter(Boolean).join(' • ')}
                  meta={
                    <>
                      {p.code ? <span>کد: {toFa(p.code)}</span> : null}
                      {p.startDate ? <span>شروع: {formatJalali(p.startDate)}</span> : null}
                    </>
                  }
                  onClick={() => navigate('project', { projectId: p.id })}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {/* آخرین عملیات */}
      {!hasNoData && (
        <section aria-label="آخرین عملیات">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-muted-foreground">آخرین عملیات</h2>
            <button
              type="button"
              onClick={() => navigate('operations')}
              className="text-xs font-medium text-primary hover:underline"
            >
              مشاهده همه
            </button>
          </div>
          {recentOperations === undefined ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-20 rounded-xl" />
              ))}
            </div>
          ) : recentOperations.length === 0 ? (
            <p className="rounded-xl border border-dashed p-4 text-center text-sm text-muted-foreground">عملیاتی ثبت نشده است</p>
          ) : (
            <div className="space-y-3">
              {recentOperations.map((op: Operation) => (
                <ItemCard
                  key={op.id}
                  title={op.title || operationTypeLabels[op.type]}
                  badges={<StatusBadge label={operationStatusLabels[op.status] ?? 'نامشخص'} variant={operationStatusVariants[op.status]} />}
                  meta={
                    <>
                      <span>{op.customTypeLabel || operationTypeLabels[op.type]}</span>
                      <span>{formatJalali(op.date)}</span>
                      {op.assigneeName ? <span>مسئول: {op.assigneeName}</span> : null}
                    </>
                  }
                  onClick={() => navigate('operations', { projectId: op.projectId, operationId: op.id })}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {/* مسیر نقشه ذهنی برای کاربر جدید */}
      {!hasNoData && (
        <section aria-label="راهنما" className="rounded-xl border bg-muted/30 p-4">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 text-primary">
              <MapIcon className="size-5 shrink-0" />
            </span>
            <div className="text-xs leading-6 text-muted-foreground">
              ساختار داده: هر <span className="font-medium text-foreground">پروژه</span> شامل{' '}
              <span className="font-medium text-foreground">مسیرها</span> است و هر مسیر شامل{' '}
              <span className="font-medium text-foreground">باکس‌ها</span>. عملیات، فیوژن، تست توان و دراپ‌کابل به پروژه (و در صورت نیاز به باکس) متصل می‌شوند.
            </div>
          </div>
        </section>
      )}
    </div>
  )
}
