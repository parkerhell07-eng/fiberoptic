'use client'

// فایبرکار — جست‌وجوی سراسری در تمام داده‌های محلی
// جست‌وجو روی متن + فیلتر نوع/وضعیت/بازه تاریخ شمسی + نتایج گروه‌بندی‌شده با ناوبری مستقیم
import * as React from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  Box as BoxIcon,
  Cable,
  ChevronLeft,
  ClipboardList,
  FolderKanban,
  Gauge,
  Route as RouteIcon,
  Search,
  SearchX,
  SlidersHorizontal,
  UserRound,
  X,
  Zap,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { EmptyState, ItemCard, JalaliDatePicker, PageHeader, StatusBadge } from '@/components/fiberkar/primitives'
import { db } from '@/lib/localdb'
import {
  boxStatusLabels,
  boxStatusVariants,
  deliveryStatusLabels,
  deliveryStatusVariants,
  installStatusLabels,
  installStatusVariants,
  operationStatusLabels,
  operationStatusVariants,
  operationTypeLabels,
  profileRoleLabels,
  projectStatusLabels,
  projectStatusVariants,
  viewTitles,
} from '@/lib/labels'
import { formatJalali, formatNum, toEnDigits, toFa } from '@/lib/persian'
import type { Box, DropCable, Fusion, Operation, PowerTest, Profile, Project, Route } from '@/lib/types'
import { useAppStore } from '@/store/app-store'

type TypeFilter =
  | 'all'
  | 'projects'
  | 'routes'
  | 'boxes'
  | 'operations'
  | 'fusions'
  | 'powerTests'
  | 'dropCables'
  | 'profiles'

const TYPE_OPTIONS: Array<{ value: TypeFilter; label: string }> = [
  { value: 'all', label: 'همه' },
  { value: 'projects', label: 'پروژه‌ها' },
  { value: 'routes', label: 'مسیرها' },
  { value: 'boxes', label: 'باکس‌ها' },
  { value: 'operations', label: 'عملیات' },
  { value: 'fusions', label: 'فیوژن' },
  { value: 'powerTests', label: 'تست توان' },
  { value: 'dropCables', label: 'دراپ‌کابل' },
  { value: 'profiles', label: 'پروفایل‌ها' },
]

// گزینه‌های وضعیت: اجتماع برچسب‌های وضعیت پروژه/عملیات/باکس/نصب (بدون تکرار)
const STATUS_OPTIONS: string[] = Array.from(
  new Set([
    ...Object.values(projectStatusLabels),
    ...Object.values(operationStatusLabels),
    ...Object.values(boxStatusLabels),
    ...Object.values(installStatusLabels),
  ])
)

interface SearchGroups {
  projects: Project[]
  routes: Route[]
  boxes: Box[]
  operations: Operation[]
  fusions: Fusion[]
  powerTests: PowerTest[]
  dropCables: DropCable[]
  profiles: Profile[]
}

const EMPTY_GROUPS: SearchGroups = {
  projects: [],
  routes: [],
  boxes: [],
  operations: [],
  fusions: [],
  powerTests: [],
  dropCables: [],
  profiles: [],
}

// بازیابی آخرین جست‌وجوی این نشست (حفظ متن و فیلترها هنگام بازگشت به صفحه)
const SEARCH_STATE_KEY = 'fiberkar:search-state'
interface StoredSearch {
  q?: string
  type?: TypeFilter
  status?: string
  from?: string
  to?: string
  archived?: boolean
}
function readStoredSearch(): StoredSearch {
  if (typeof window === 'undefined') return {}
  try {
    return JSON.parse(window.sessionStorage.getItem(SEARCH_STATE_KEY) || '{}') as StoredSearch
  } catch {
    return {}
  }
}

/** epoch ms → 'YYYY-MM-DD' محلی (برای مقایسه با بازه تاریخ) */
function msToISODate(ms: number): string {
  const d = new Date(ms)
  const p = (x: number) => String(x).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

function GroupSection({
  title,
  icon,
  count,
  children,
}: {
  title: string
  icon: React.ReactNode
  count: number
  children: React.ReactNode
}) {
  return (
    <section aria-label={title}>
      <div className="mb-2 flex items-center gap-2">
        <span className="text-primary" aria-hidden>
          {icon}
        </span>
        <h2 className="text-sm font-semibold">{title}</h2>
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs tabular-nums">{toFa(count)}</span>
      </div>
      <div className="space-y-2">{children}</div>
    </section>
  )
}

const NavigateIcon = <ChevronLeft className="size-4 text-muted-foreground" aria-hidden />

export default function SearchView() {
  const back = useAppStore((s) => s.back)
  const navigate = useAppStore((s) => s.navigate)
  const params = useAppStore((s) => s.params)
  // خواندن یک‌باره آخرین وضعیت جست‌وجوی نشست (فقط برای مقداردهی اولیه)
  const [initial] = React.useState<StoredSearch>(readStoredSearch)

  // متن جست‌وجو: ورودی فوری + مقدار تأخیری (debounce 250ms)
  const [input, setInput] = React.useState(() => params.q || initial.q || '')
  const [q, setQ] = React.useState(() => (params.q || initial.q || '').trim())

  React.useEffect(() => {
    const t = window.setTimeout(() => setQ(input.trim()), 250)
    return () => window.clearTimeout(t)
  }, [input])

  // ورود به صفحه با q از بیرون (مثلاً از داشبورد) → پیش‌فرض کردن ورودی
  React.useEffect(() => {
    if (!params.q) return
    setInput((prev) => (prev === params.q ? prev : (params.q as string)))
    setQ((prev) => (prev === (params.q as string).trim() ? prev : (params.q as string).trim()))
  }, [params.q])

  // فیلترها
  const [typeFilter, setTypeFilter] = React.useState<TypeFilter>(initial.type ?? 'all')
  const [statusFilter, setStatusFilter] = React.useState<string>(initial.status ?? 'all')
  const [fromDate, setFromDate] = React.useState<string | undefined>(initial.from)
  const [toDate, setToDate] = React.useState<string | undefined>(initial.to)
  const [includeArchived, setIncludeArchived] = React.useState<boolean>(initial.archived ?? false)

  // ذخیره وضعیت جست‌وجو در session
  React.useEffect(() => {
    const data: StoredSearch = { q, type: typeFilter, status: statusFilter, from: fromDate, to: toDate, archived: includeArchived }
    try {
      window.sessionStorage.setItem(SEARCH_STATE_KEY, JSON.stringify(data))
    } catch {
      /* حافظه session در دسترس نیست؛ نادیده گرفته می‌شود */
    }
  }, [q, typeFilter, statusFilter, fromDate, toDate, includeArchived])

  const hasFilters = typeFilter !== 'all' || statusFilter !== 'all' || !!fromDate || !!toDate || includeArchived
  function resetFilters() {
    setTypeFilter('all')
    setStatusFilter('all')
    setFromDate(undefined)
    setToDate(undefined)
    setIncludeArchived(false)
  }

  // واکشی و فیلتر زنده داده‌ها (مقیاس محلی؛ واکشی کامل جدول‌ها سریع است)
  const results = useLiveQuery<SearchGroups | undefined>(async () => {
    const needle = toEnDigits(q).trim().toLowerCase()
    if (!needle) return EMPTY_GROUPS // بدون عبارت، فقط راهنما نمایش داده می‌شود

    const [projects, routes, boxes, operations, fusions, powerTests, dropCables, profiles] = await Promise.all([
      db.projects.toArray(),
      db.routes.toArray(),
      db.boxes.toArray(),
      db.operations.toArray(),
      db.fusions.toArray(),
      db.powerTests.toArray(),
      db.dropCables.toArray(),
      db.profiles.toArray(),
    ])

    const hasStatusFilter = statusFilter !== 'all'
    const dateOk = (iso: string | undefined) => {
      if (!fromDate && !toDate) return true
      if (!iso) return false
      if (fromDate && iso < fromDate) return false
      if (toDate && iso > toDate) return false
      return true
    }
    const createdOk = (ms: number) => dateOk(msToISODate(ms))
    const statusOk = (label: string) => !hasStatusFilter || label === statusFilter
    const archOk = (r: { archived: 0 | 1 }) => includeArchived || r.archived !== 1
    const textOk = (fields: Array<string | number | undefined>) => {
      const hay = fields.map((f) => toEnDigits(String(f ?? '')).toLowerCase()).join('\n')
      return hay.includes(needle)
    }

    const fp = projects.filter(
      (p) => archOk(p) && createdOk(p.createdAt) && statusOk(projectStatusLabels[p.status]) && textOk([p.name, p.code, p.client, p.area, p.description])
    )
    const fr = routes.filter((r) => archOk(r) && createdOk(r.createdAt) && textOk([r.name, r.code, r.description]))
    const fb = boxes.filter(
      (b) => archOk(b) && createdOk(b.createdAt) && statusOk(boxStatusLabels[b.status]) && textOk([b.number, b.location, b.cableSpec, b.description])
    )
    const fo = operations.filter(
      (o) => dateOk(o.date) && statusOk(operationStatusLabels[o.status]) && textOk([o.title, o.description, o.assigneeName, o.customTypeLabel, o.techSpecs])
    )
    const ff = fusions.filter((f) => dateOk(f.fusionDate) && textOk([f.fiberNumbers, f.tubeNumber, f.cableSpec, f.connectionId, f.deviceModel, f.result, f.description]))
    const ftp = powerTests.filter((t) => dateOk(t.date) && textOk([t.location, t.deviceModel, t.description]))
    const fd = dropCables.filter(
      (c) => dateOk(c.date) && statusOk(installStatusLabels[c.installStatus]) && textOk([c.destination, c.serviceId, c.address, c.executorName, c.cableType, c.description])
    )
    const fpr = profiles.filter((p) => textOk([p.firstName, p.lastName, p.company, p.city]))

    const on = (t: TypeFilter) => typeFilter === 'all' || typeFilter === t
    return {
      projects: on('projects') ? fp : [],
      routes: on('routes') ? fr : [],
      boxes: on('boxes') ? fb : [],
      operations: on('operations') ? fo : [],
      fusions: on('fusions') ? ff : [],
      powerTests: on('powerTests') ? ftp : [],
      dropCables: on('dropCables') ? fd : [],
      profiles: on('profiles') ? fpr : [],
    }
  }, [q, typeFilter, statusFilter, fromDate, toDate, includeArchived])

  const groups = results ?? EMPTY_GROUPS
  const total =
    groups.projects.length +
    groups.routes.length +
    groups.boxes.length +
    groups.operations.length +
    groups.fusions.length +
    groups.powerTests.length +
    groups.dropCables.length +
    groups.profiles.length
  const groupCount = [
    groups.projects,
    groups.routes,
    groups.boxes,
    groups.operations,
    groups.fusions,
    groups.powerTests,
    groups.dropCables,
    groups.profiles,
  ].filter((a) => a.length > 0).length

  return (
    <div className="space-y-4">
      <PageHeader
        title={viewTitles.search}
        subtitle="جست‌وجو در پروژه‌ها، مسیرها، باکس‌ها، عملیات و پروفایل‌ها"
        onBack={back}
      />

      {/* ورودی جست‌وجو */}
      <div className="relative">
        <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="جست‌وجو… (نام، شماره، مسئول، شناسه کابل)"
          aria-label="عبارت جست‌وجو"
          className="min-h-11 pe-10 ps-9"
        />
        {input && (
          <button
            type="button"
            onClick={() => setInput('')}
            aria-label="پاک کردن عبارت جست‌وجو"
            className="absolute end-2 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <X className="size-4" aria-hidden />
          </button>
        )}
      </div>

      {/* فیلترها */}
      <section className="rounded-xl border bg-card p-4" aria-label="فیلترهای جست‌وجو">
        <div className="mb-3 flex items-center gap-2">
          <SlidersHorizontal className="size-4 text-primary" aria-hidden />
          <h2 className="text-sm font-semibold">فیلترها</h2>
          {hasFilters && (
            <Button variant="ghost" size="sm" className="ms-auto min-h-9" onClick={resetFilters}>
              حذف فیلترها
            </Button>
          )}
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex w-full flex-col gap-1.5 sm:w-44">
            <Label className="text-xs text-muted-foreground">نوع</Label>
            <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as TypeFilter)}>
              <SelectTrigger className="min-h-11 w-full" aria-label="نوع داده">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TYPE_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex w-full flex-col gap-1.5 sm:w-44">
            <Label className="text-xs text-muted-foreground">وضعیت</Label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="min-h-11 w-full" aria-label="وضعیت">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">همه</SelectItem>
                {STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex min-w-40 flex-1 flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">از تاریخ</Label>
            <JalaliDatePicker value={fromDate} onChange={setFromDate} placeholder="از ابتدا" />
          </div>
          <div className="flex min-w-40 flex-1 flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">تا تاریخ</Label>
            <JalaliDatePicker value={toDate} onChange={setToDate} placeholder="تا امروز" />
          </div>
          <div className="flex min-h-11 items-center justify-between gap-3 rounded-lg border px-3 sm:justify-start sm:border-0 sm:px-0">
            <Label htmlFor="include-archived" className="text-sm">
              شامل آرشیو
            </Label>
            <Switch id="include-archived" checked={includeArchived} onCheckedChange={setIncludeArchived} aria-label="شامل آرشیو" />
          </div>
        </div>
      </section>

      {/* نتایج */}
      {results === undefined ? (
        <div className="space-y-2" aria-label="در حال بارگذاری نتایج">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))}
        </div>
      ) : !q ? (
        <EmptyState
          icon={<Search className="size-10" aria-hidden />}
          title="چه چیزی را جست‌وجو کنیم؟"
          hint="نام پروژه، شماره باکس، مسیر، تاریخ، مسئول، نوع عملیات یا شناسه کابل را جست‌وجو کنید"
        />
      ) : total === 0 ? (
        <EmptyState
          icon={<SearchX className="size-10" aria-hidden />}
          title="نتیجه‌ای پیدا نشد"
          hint={`عبارت «${q}» در هیچ رکوردی یافت نشد. فیلترها را تغییر دهید یا عبارت دیگری امتحان کنید.`}
        />
      ) : (
        <div className="space-y-5">
          <p className="text-xs text-muted-foreground" role="status">
            {toFa(total)} نتیجه در {toFa(groupCount)} گروه
          </p>

          {groups.projects.length > 0 && (
            <GroupSection title="پروژه‌ها" icon={<FolderKanban className="size-4" />} count={groups.projects.length}>
              {groups.projects.map((p) => (
                <ItemCard
                  key={p.id}
                  title={p.name}
                  subtitle={[p.client, p.area].filter(Boolean).join(' — ') || undefined}
                  meta={
                    <>
                      <span>کد: {p.code || '—'}</span>
                      <span>{formatJalali(p.startDate || p.createdAt)}</span>
                    </>
                  }
                  badges={<StatusBadge label={projectStatusLabels[p.status]} variant={projectStatusVariants[p.status]} />}
                  onClick={() => navigate('project', { projectId: p.id })}
                  trailing={NavigateIcon}
                />
              ))}
            </GroupSection>
          )}

          {groups.routes.length > 0 && (
            <GroupSection title="مسیرها" icon={<RouteIcon className="size-4" />} count={groups.routes.length}>
              {groups.routes.map((r) => (
                <ItemCard
                  key={r.id}
                  title={r.name}
                  subtitle={r.description || undefined}
                  meta={
                    <>
                      <span>کد: {r.code || '—'}</span>
                      <span>{formatJalali(r.createdAt)}</span>
                    </>
                  }
                  onClick={() => navigate('route', { projectId: r.projectId, routeId: r.id })}
                  trailing={NavigateIcon}
                />
              ))}
            </GroupSection>
          )}

          {groups.boxes.length > 0 && (
            <GroupSection title="باکس‌ها" icon={<BoxIcon className="size-4" />} count={groups.boxes.length}>
              {groups.boxes.map((b) => (
                <ItemCard
                  key={b.id}
                  title={`باکس ${b.number}`}
                  subtitle={[b.location, b.cableSpec].filter(Boolean).join(' — ') || undefined}
                  meta={
                    <>
                      {b.capacity && <span>ظرفیت: {b.capacity}</span>}
                      <span>{formatJalali(b.createdAt)}</span>
                    </>
                  }
                  badges={<StatusBadge label={boxStatusLabels[b.status]} variant={boxStatusVariants[b.status]} />}
                  onClick={() => navigate('box', { projectId: b.projectId, routeId: b.routeId, boxId: b.id })}
                  trailing={NavigateIcon}
                />
              ))}
            </GroupSection>
          )}

          {groups.operations.length > 0 && (
            <GroupSection title="عملیات" icon={<ClipboardList className="size-4" />} count={groups.operations.length}>
              {groups.operations.map((o) => (
                <ItemCard
                  key={o.id}
                  title={o.title}
                  subtitle={
                    [
                      o.type === 'custom' && o.customTypeLabel ? o.customTypeLabel : operationTypeLabels[o.type],
                      o.assigneeName ? `مسئول: ${o.assigneeName}` : '',
                    ]
                      .filter(Boolean)
                      .join(' — ') || undefined
                  }
                  meta={
                    <>
                      <span>{formatJalali(o.date)}</span>
                      {o.techSpecs && <span>مشخصات: {o.techSpecs}</span>}
                    </>
                  }
                  badges={<StatusBadge label={operationStatusLabels[o.status]} variant={operationStatusVariants[o.status]} />}
                  onClick={() => navigate('operations', { projectId: o.projectId, operationId: o.id })}
                  trailing={NavigateIcon}
                />
              ))}
            </GroupSection>
          )}

          {groups.fusions.length > 0 && (
            <GroupSection title="فیوژن" icon={<Zap className="size-4" />} count={groups.fusions.length}>
              {groups.fusions.map((f) => (
                <ItemCard
                  key={f.id}
                  title={f.connectionId ? `فیوژن (${f.connectionId})` : `فیوژن تارهای ${f.fiberNumbers || '—'}`}
                  subtitle={f.result || f.description || undefined}
                  meta={
                    <>
                      {f.tubeNumber && <span dir="auto">تیوب: {f.tubeNumber}</span>}
                      {f.cableSpec && <span>{f.cableSpec}</span>}
                      <span>{formatJalali(f.fusionDate)}</span>
                    </>
                  }
                  onClick={() => navigate('fusion', { projectId: f.projectId, boxId: f.boxId, fusionId: f.id })}
                  trailing={NavigateIcon}
                />
              ))}
            </GroupSection>
          )}

          {groups.powerTests.length > 0 && (
            <GroupSection title="تست توان" icon={<Gauge className="size-4" />} count={groups.powerTests.length}>
              {groups.powerTests.map((t) => (
                <ItemCard
                  key={t.id}
                  title={t.location || 'تست توان'}
                  subtitle={t.deviceModel ? `دستگاه: ${t.deviceModel}` : undefined}
                  meta={
                    <>
                      <span dir="ltr" className="font-medium">
                        {formatNum(t.value, 2)} {t.unit}
                      </span>
                      <span>{formatJalali(t.date)}</span>
                      {t.assigneeName && <span>مسئول: {t.assigneeName}</span>}
                    </>
                  }
                  onClick={() => navigate('power-tests', { projectId: t.projectId, powerTestId: t.id })}
                  trailing={NavigateIcon}
                />
              ))}
            </GroupSection>
          )}

          {groups.dropCables.length > 0 && (
            <GroupSection title="دراپ‌کابل" icon={<Cable className="size-4" />} count={groups.dropCables.length}>
              {groups.dropCables.map((c) => (
                <ItemCard
                  key={c.id}
                  title={c.destination || 'دراپ‌کابل'}
                  subtitle={[c.address, c.serviceId ? `شناسه سرویس: ${c.serviceId}` : ''].filter(Boolean).join(' — ') || undefined}
                  meta={
                    <>
                      {c.cableType && <span>کابل: {c.cableType}</span>}
                      {c.executorName && <span>مجری: {c.executorName}</span>}
                      <span>{formatJalali(c.date)}</span>
                    </>
                  }
                  badges={
                    <>
                      <StatusBadge label={installStatusLabels[c.installStatus]} variant={installStatusVariants[c.installStatus]} />
                      <StatusBadge label={deliveryStatusLabels[c.deliveryStatus]} variant={deliveryStatusVariants[c.deliveryStatus]} />
                    </>
                  }
                  onClick={() => navigate('drop-cables', { projectId: c.projectId, dropCableId: c.id })}
                  trailing={NavigateIcon}
                />
              ))}
            </GroupSection>
          )}

          {groups.profiles.length > 0 && (
            <GroupSection title="پروفایل‌ها" icon={<UserRound className="size-4" />} count={groups.profiles.length}>
              {groups.profiles.map((p) => (
                <ItemCard
                  key={p.id}
                  title={`${p.firstName} ${p.lastName}`.trim() || 'پروفایل'}
                  subtitle={[p.company, p.city].filter(Boolean).join(' — ') || undefined}
                  meta={
                    <>
                      <span>
                        {p.roles
                          .map((r) => (r === 'custom' && p.customRoleLabel ? p.customRoleLabel : profileRoleLabels[r]))
                          .filter(Boolean)
                          .join('، ') || '—'}
                      </span>
                    </>
                  }
                  onClick={() => navigate('profiles')}
                  trailing={NavigateIcon}
                />
              ))}
            </GroupSection>
          )}
        </div>
      )}
    </div>
  )
}
