'use client'

// فایبرکار — داشبورد (آمار واقعی از IndexedDB + میان‌برها + آخرین رکوردها)
import * as React from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  Boxes,
  Cable,
  ClipboardList,
  DatabaseBackup,
  FileDown,
  FolderKanban,
  FolderPlus,
  Gauge,
  Images,
  Map as MapIcon,
  Ruler,
  Sparkles,
  Users,
  Waypoints,
} from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import {
  EmptyState,
  ItemCard,
  StatCard,
  StatusBadge,
} from '@/components/fiberkar/primitives'
import { useAppStore } from '@/store/app-store'
import { db, getDashboardStats } from '@/lib/localdb'
import { formatJalali, formatMeters, toFa } from '@/lib/persian'
import {
  operationStatusLabels,
  operationStatusVariants,
  operationTypeLabels,
  projectStatusLabels,
  projectStatusVariants,
} from '@/lib/labels'
import type { Operation, Project } from '@/lib/types'

const SHORTCUTS = [
  { label: 'پروژه جدید', icon: FolderPlus, view: 'projects' },
  { label: 'ثبت عملیات', icon: ClipboardList, view: 'operations' },
  { label: 'تست توان', icon: Gauge, view: 'power-tests' },
  { label: 'دراپ‌کابل', icon: Cable, view: 'drop-cables' },
  { label: 'گزارش PDF', icon: FileDown, view: 'reports' },
  { label: 'پشتیبان‌گیری', icon: DatabaseBackup, view: 'backup' },
] as const

export default function DashboardView() {
  const navigate = useAppStore((s) => s.navigate)

  // آمار کلی — داده واقعی، بدون داده ساختگی
  const stats = useLiveQuery(() => getDashboardStats(), [])

  const recentProjects = useLiveQuery(async () => {
    const ps = await db.projects.filter((p) => !p.archived).toArray()
    return ps.sort((a, b) => b.createdAt - a.createdAt).slice(0, 5)
  }, [])

  const recentOperations = useLiveQuery(async () => {
    const ops = await db.operations.orderBy('createdAt').reverse().limit(5).toArray()
    return ops
  }, [])

  const hasNoData = stats !== undefined && stats.projectsTotal === 0

  return (
    <div className="space-y-6">
      {/* عنوان */}
      <div>
        <h1 className="text-xl font-bold sm:text-2xl">داشبورد</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">نمای کلی کارهای فیبر نوری شما — همه داده‌ها فقط روی همین دستگاه</p>
      </div>

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
        <h2 className="mb-3 text-sm font-semibold text-muted-foreground">آمار کلی</h2>
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
            <StatCard label="پروژه‌های فعال" value={toFa(stats.projectsActive)} icon={<FolderKanban className="size-4" />} onClick={() => navigate('projects')} tone="accent" />
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
                  badges={<StatusBadge label={projectStatusLabels[p.status]} variant={projectStatusVariants[p.status]} />}
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
                  badges={<StatusBadge label={operationStatusLabels[op.status]} variant={operationStatusVariants[op.status]} />}
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
