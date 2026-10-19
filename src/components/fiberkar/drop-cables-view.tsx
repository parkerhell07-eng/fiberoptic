'use client'

// فایبرکار — ماژول دراپ‌کابل: فیلترها، آمار واقعی، لیست، فرم ثبت/ویرایش و عکس‌ها
// قاعده سلامت داده: consumedUser (واردشده کاربر) هرگز تغییر نمی‌کند؛ consumedAuto فقط
// وقتی initial و returned معتبر باشند و returned<=initial محاسبه می‌شود (برچسب «محاسباتی»).
import * as React from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { toast } from 'sonner'
import {
  Cable,
  MoreVertical,
  Pencil,
  Plus,
  Ruler,
  Slice,
  Trash2,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { useAppStore } from '@/store/app-store'
import {
  createDropCable,
  db,
  deleteDropCableCascade,
  profileSnapshot,
  updateDropCable,
} from '@/lib/localdb'
import type { DropCableInput } from '@/lib/localdb'
import {
  computeConsumed,
  formatJalali,
  formatMeters,
  formatNum,
  toFa,
  todayISO,
  validateMeterage,
} from '@/lib/persian'
import {
  deliveryStatusLabels,
  deliveryStatusVariants,
  installMethodLabels,
  installStatusLabels,
  installStatusVariants,
  messages,
} from '@/lib/labels'
import type {
  Box,
  DeliveryStatus,
  DropCable,
  InstallMethod,
  InstallStatus,
  Profile,
  Project,
  Route,
} from '@/lib/types'
import { cn } from '@/lib/utils'
import {
  ConfirmDialog,
  EmptyState,
  Field,
  ItemCard,
  JalaliDatePicker,
  NumberField,
  PageHeader,
  SegmentedTabs,
  StatCard,
  StatusBadge,
} from './primitives'
import { PhotoPickerButton } from './photo-picker'
import { PhotoGallery } from './photo-gallery'
import { CsvExportButton } from './csv-export-button'

const ALL = 'all'
const NONE = '__none__'

type FormErrors = Partial<
  Record<
    | 'projectId'
    | 'destination'
    | 'cableType'
    | 'date'
    | 'initialMeters'
    | 'returnedMeters'
    | 'consumedUser'
    | 'coreCount'
    | 'customMethodLabel',
    string
  >
>

// ================= کمکی‌های نمایش =================

function methodLabel(c: DropCable): string {
  // خوانش دفاعی — رکورد بازگردی‌شده با مقدار نامعتبر، لیبل «—» می‌گیرد
  return c.installMethod === 'custom'
    ? c.customMethodLabel || installMethodLabels.custom
    : installMethodLabels[c.installMethod] ?? '—'
}

/** متراژ مصرفی با برچسب منبع — فقط مقادیر معتبر نمایش داده می‌شوند */
function ConsumedTag({ cable }: { cable: DropCable }) {
  const res = computeConsumed(cable.initialMeters, cable.returnedMeters, cable.consumedUser)
  if (!res.valid || res.value === undefined) return <span>مصرف: —</span>
  return (
    <span className="inline-flex items-center gap-1">
      مصرف: {formatMeters(res.value)}
      <span
        className={cn(
          'rounded px-1 py-px text-[10px] leading-4',
          res.source === 'user' ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400' : 'bg-primary/10 text-primary'
        )}
      >
        {res.source === 'user' ? 'واردشده توسط کاربر' : 'محاسباتی'}
      </span>
    </span>
  )
}

function RowMenu({ name, onEdit, onDelete }: { name: string; onEdit: () => void; onDelete: () => void }) {
  return (
    <DropdownMenu dir="rtl">
      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
        <Button variant="ghost" size="icon" className="size-11" aria-label={`گزینه‌های ${name}`}>
          <MoreVertical className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
        <DropdownMenuItem onClick={onEdit}>
          <Pencil className="size-4" />
          ویرایش
        </DropdownMenuItem>
        <DropdownMenuItem variant="destructive" onClick={onDelete}>
          <Trash2 className="size-4" />
          حذف
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// ================= نمای اصلی دراپ‌کابل =================

export default function DropCablesView() {
  const params = useAppStore((s) => s.params)
  const back = useAppStore((s) => s.back)

  // ---------- داده‌ها (زنده از IndexedDB) ----------
  const projects = useLiveQuery(() => db.projects.filter((p) => !p.archived).toArray(), [])
  const routes = useLiveQuery(() => db.routes.filter((r) => !r.archived).toArray(), [])
  const boxes = useLiveQuery(() => db.boxes.filter((b) => !b.archived).toArray(), [])
  const cables = useLiveQuery(() => db.dropCables.orderBy('createdAt').reverse().toArray(), [])
  const profiles = useLiveQuery(() => db.profiles.toArray(), [])

  const projectMap = React.useMemo(() => new Map((projects ?? []).map((p) => [p.id, p])), [projects])
  const routeMap = React.useMemo(() => new Map((routes ?? []).map((r) => [r.id, r])), [routes])
  const boxMap = React.useMemo(() => new Map((boxes ?? []).map((b) => [b.id, b])), [boxes])

  // ---------- فیلترها ----------
  const [filterProject, setFilterProject] = React.useState<string>(params.projectId ?? ALL)
  const [filterRoute, setFilterRoute] = React.useState<string>(params.routeId ?? ALL)
  const [filterBox, setFilterBox] = React.useState<string>(params.boxId ?? ALL)
  const [filterExecutor, setFilterExecutor] = React.useState<string>(ALL)
  const [filterInstall, setFilterInstall] = React.useState<string>(ALL)
  const [filterDelivery, setFilterDelivery] = React.useState<string>(ALL)
  const [filterDateFrom, setFilterDateFrom] = React.useState<string | undefined>(undefined)
  const [filterDateTo, setFilterDateTo] = React.useState<string | undefined>(undefined)

  // همگام‌سازی با پارامترهای ناوبری (ورود از پروژه/مسیر/باکس)
  React.useEffect(() => {
    setFilterProject(params.projectId ?? ALL)
    setFilterRoute(params.routeId ?? ALL)
    setFilterBox(params.boxId ?? ALL)
  }, [params.projectId, params.routeId, params.boxId])

  const routeFilterOptions = React.useMemo(() => {
    const list = routes ?? []
    return filterProject === ALL ? list : list.filter((r) => r.projectId === filterProject)
  }, [routes, filterProject])

  const executorOptions = React.useMemo(() => {
    const names = new Set<string>()
    for (const p of profiles ?? []) {
      const n = `${p.firstName} ${p.lastName}`.trim()
      if (n) names.add(n)
    }
    for (const c of cables ?? []) if (c.executorName) names.add(c.executorName)
    return Array.from(names).sort((a, b) => a.localeCompare(b, 'fa'))
  }, [profiles, cables])

  const filtered = React.useMemo(() => {
    const list = cables ?? []
    return list.filter(
      (c) =>
        (filterProject === ALL || c.projectId === filterProject) &&
        (filterRoute === ALL || c.routeId === filterRoute) &&
        (filterBox === ALL || c.sourceBoxId === filterBox) &&
        (filterExecutor === ALL || c.executorName === filterExecutor) &&
        (filterInstall === ALL || c.installStatus === filterInstall) &&
        (filterDelivery === ALL || c.deliveryStatus === filterDelivery) &&
        (!filterDateFrom || c.date >= filterDateFrom) &&
        (!filterDateTo || c.date <= filterDateTo)
    )
  }, [cables, filterProject, filterRoute, filterBox, filterExecutor, filterInstall, filterDelivery, filterDateFrom, filterDateTo])

  // آمار واقعی — مجموع فقط از مقادیر معتبر computeConsumed (بدون دوباره‌شماری)
  const stats = React.useMemo(() => {
    let initialTotal = 0
    let consumedTotal = 0
    for (const c of filtered) {
      if (c.initialMeters !== undefined && Number.isFinite(c.initialMeters) && c.initialMeters >= 0) {
        initialTotal += c.initialMeters
      }
      const res = computeConsumed(c.initialMeters, c.returnedMeters, c.consumedUser)
      if (res.valid && res.value !== undefined) consumedTotal += res.value
    }
    return { count: filtered.length, initialTotal, consumedTotal }
  }, [filtered])

  // ---------- دیالوگ‌ها ----------
  const [formOpen, setFormOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<DropCable | null>(null)
  const [deleteId, setDeleteId] = React.useState<string | null>(null)
  const [deleting, setDeleting] = React.useState(false)

  const openCreate = () => {
    setEditing(null)
    setFormOpen(true)
  }
  const openEdit = (c: DropCable) => {
    setEditing(c)
    setFormOpen(true)
  }

  const prefill = React.useMemo(
    () => ({
      projectId: filterProject !== ALL ? filterProject : undefined,
      routeId: filterRoute !== ALL ? filterRoute : undefined,
      sourceBoxId: filterBox !== ALL ? filterBox : undefined,
    }),
    [filterProject, filterRoute, filterBox]
  )

  const deleteTarget = deleteId ? (cables ?? []).find((c) => c.id === deleteId) ?? null : null

  const handleDelete = async () => {
    if (!deleteId) return
    setDeleting(true)
    try {
      await deleteDropCableCascade(deleteId)
      toast.success(messages.deleted)
      setDeleteId(null)
    } catch {
      toast.error(messages.error)
    } finally {
      setDeleting(false)
    }
  }

  // ---------- لینک عمیق: باز شدن خودکار ویرایش برای dropCableId (فقط یک بار در هر نشانی) ----------
  const deepLinkConsumedRef = React.useRef(false)
  React.useEffect(() => {
    deepLinkConsumedRef.current = false
  }, [params.dropCableId])
  React.useEffect(() => {
    if (deepLinkConsumedRef.current) return
    const id = params.dropCableId
    if (!id || !cables) return
    deepLinkConsumedRef.current = true
    const rec = cables.find((x) => x.id === id)
    if (rec) openEdit(rec)
     
  }, [cables, params.dropCableId])

  // ---------- چیپ‌های فیلتر فعال ----------
  const chips: Array<{ key: string; label: string; onRemove: () => void }> = []
  if (filterProject !== ALL)
    chips.push({
      key: 'project',
      label: `پروژه: ${projectMap.get(filterProject)?.name ?? '—'}`,
      onRemove: () => setFilterProject(ALL),
    })
  if (filterRoute !== ALL)
    chips.push({
      key: 'route',
      label: `مسیر: ${routeMap.get(filterRoute)?.name ?? '—'}`,
      onRemove: () => setFilterRoute(ALL),
    })
  if (filterBox !== ALL)
    chips.push({
      key: 'box',
      label: `باکس مبدأ: ${toFa(boxMap.get(filterBox)?.number ?? '—')}`,
      onRemove: () => setFilterBox(ALL),
    })
  if (filterExecutor !== ALL)
    chips.push({ key: 'executor', label: `مجری: ${filterExecutor}`, onRemove: () => setFilterExecutor(ALL) })
  if (filterInstall !== ALL)
    chips.push({
      key: 'install',
      label: `وضعیت نصب: ${installStatusLabels[filterInstall as InstallStatus] ?? '—'}`,
      onRemove: () => setFilterInstall(ALL),
    })
  if (filterDelivery !== ALL)
    chips.push({
      key: 'delivery',
      label: `وضعیت تحویل: ${deliveryStatusLabels[filterDelivery as DeliveryStatus] ?? '—'}`,
      onRemove: () => setFilterDelivery(ALL),
    })
  if (filterDateFrom) chips.push({ key: 'from', label: `از ${formatJalali(filterDateFrom)}`, onRemove: () => setFilterDateFrom(undefined) })
  if (filterDateTo) chips.push({ key: 'to', label: `تا ${formatJalali(filterDateTo)}`, onRemove: () => setFilterDateTo(undefined) })

  const clearAllFilters = () => {
    setFilterProject(ALL)
    setFilterRoute(ALL)
    setFilterBox(ALL)
    setFilterExecutor(ALL)
    setFilterInstall(ALL)
    setFilterDelivery(ALL)
    setFilterDateFrom(undefined)
    setFilterDateTo(undefined)
  }

  // ---------- زیرنویس هدر بر اساس زمینه ناوبری ----------
  const headerSubtitle = React.useMemo(() => {
    const parts: string[] = []
    if (params.projectId) parts.push(`پروژه: ${projectMap.get(params.projectId)?.name ?? '—'}`)
    if (params.routeId) parts.push(`مسیر: ${routeMap.get(params.routeId)?.name ?? '—'}`)
    if (params.boxId) parts.push(`باکس مبدأ: ${toFa(boxMap.get(params.boxId)?.number ?? '—')}`)
    return parts.length > 0 ? parts.join(' • ') : 'ثبت و مدیریت دراپ‌کابل‌ها'
  }, [params.projectId, params.routeId, params.boxId, projectMap, routeMap, boxMap])

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="دراپ‌کابل"
        subtitle={headerSubtitle}
        onBack={back}
        actions={
          <div className="flex items-center gap-2">
            <CsvExportButton kind="drop-cables" projectId={filterProject !== ALL ? filterProject : undefined} className="min-h-11" />
            <Button onClick={openCreate} className="min-h-11">
              <Plus className="size-4" />
              ثبت دراپ‌کابل
            </Button>
          </div>
        }
      />

      {/* فیلترها */}
      <section aria-label="فیلترها" className="flex flex-col gap-3 rounded-xl border bg-card p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">پروژه</Label>
            <Select
              value={filterProject}
              onValueChange={(v) => {
                setFilterProject(v)
                setFilterRoute(ALL)
              }}
            >
              <SelectTrigger className="min-h-11 w-full" aria-label="فیلتر پروژه">
                <SelectValue />
              </SelectTrigger>
              <SelectContent dir="rtl">
                <SelectItem value={ALL}>همه پروژه‌ها</SelectItem>
                {(projects ?? []).map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">مسیر</Label>
            <Select value={filterRoute} onValueChange={setFilterRoute}>
              <SelectTrigger className="min-h-11 w-full" aria-label="فیلتر مسیر">
                <SelectValue />
              </SelectTrigger>
              <SelectContent dir="rtl">
                <SelectItem value={ALL}>همه مسیرها</SelectItem>
                {routeFilterOptions.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">مجری</Label>
            <Select value={filterExecutor} onValueChange={setFilterExecutor}>
              <SelectTrigger className="min-h-11 w-full" aria-label="فیلتر مجری">
                <SelectValue />
              </SelectTrigger>
              <SelectContent dir="rtl">
                <SelectItem value={ALL}>همه مجری‌ها</SelectItem>
                {executorOptions.map((n) => (
                  <SelectItem key={n} value={n}>
                    {n}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">وضعیت نصب</Label>
            <SegmentedTabs
              value={filterInstall}
              onChange={setFilterInstall}
              options={[
                { value: ALL, label: 'همه' },
                { value: 'not_installed', label: installStatusLabels.not_installed },
                { value: 'in_progress', label: installStatusLabels.in_progress },
                { value: 'installed', label: installStatusLabels.installed },
              ]}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">وضعیت تحویل</Label>
            <SegmentedTabs
              value={filterDelivery}
              onChange={setFilterDelivery}
              options={[
                { value: ALL, label: 'همه' },
                { value: 'delivered', label: deliveryStatusLabels.delivered },
                { value: 'not_delivered', label: deliveryStatusLabels.not_delivered },
              ]}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">از تاریخ</Label>
            <JalaliDatePicker value={filterDateFrom} onChange={setFilterDateFrom} placeholder="بدون محدودیت" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">تا تاریخ</Label>
            <JalaliDatePicker value={filterDateTo} onChange={setFilterDateTo} placeholder="بدون محدودیت" />
          </div>
        </div>

        {chips.length > 0 && (
          <div className="flex flex-wrap items-center gap-2" aria-label="فیلترهای فعال">
            {chips.map((ch) => (
              <span
                key={ch.key}
                className="flex items-center gap-1 rounded-full border bg-muted/50 py-1 pr-3 pl-1 text-xs"
              >
                {ch.label}
                <button
                  type="button"
                  onClick={ch.onRemove}
                  aria-label={`حذف فیلتر ${ch.label}`}
                  className="flex size-5 items-center justify-center rounded-full transition-colors hover:bg-accent"
                >
                  <X className="size-3" />
                </button>
              </span>
            ))}
            {chips.length > 1 && (
              <button
                type="button"
                onClick={clearAllFilters}
                className="min-h-8 rounded-full px-3 text-xs font-medium text-destructive transition-colors hover:bg-destructive/10"
              >
                حذف همه فیلترها
              </button>
            )}
          </div>
        )}
      </section>

      {/* آمار واقعی */}
      <section aria-label="آمار" className="grid grid-cols-3 gap-3">
        <StatCard label="تعداد رکوردها" value={toFa(stats.count)} icon={<Cable className="size-4" />} />
        <StatCard
          label="مجموع متراژ اولیه (متر)"
          value={formatNum(stats.initialTotal, 1)}
          icon={<Ruler className="size-4" />}
        />
        <StatCard
          label="مجموع متراژ مصرفی (متر)"
          value={formatNum(stats.consumedTotal, 1)}
          icon={<Slice className="size-4" />}
          tone="accent"
        />
      </section>

      {/* لیست */}
      {cables === undefined ? (
        <div className="flex flex-col gap-4" aria-label="در حال بارگذاری">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        chips.length > 0 ? (
          <EmptyState
            icon={<Cable className="size-10" />}
            title="با این فیلترها موردی یافت نشد"
            hint="فیلترها را تغییر دهید یا پاک کنید."
            actionLabel="پاک‌کردن فیلترها"
            onAction={clearAllFilters}
          />
        ) : (
          <EmptyState
            icon={<Cable className="size-10" />}
            title="هنوز دراپ‌کابلی ثبت نشده است"
            hint="اولین دراپ‌کابل را با مشخصات کابل، مجری و متراژ ثبت کنید."
            actionLabel="ثبت دراپ‌کابل"
            onAction={openCreate}
          />
        )
      ) : (
        <div className="flex flex-col gap-4">
          {filtered.map((c) => {
            const box = c.sourceBoxId ? boxMap.get(c.sourceBoxId) : undefined
            const subtitleParts = [c.address, c.serviceId ? `شناسه سرویس: ${c.serviceId}` : ''].filter(Boolean)
            return (
              <ItemCard
                key={c.id}
                title={c.destination}
                subtitle={subtitleParts.length > 0 ? subtitleParts.join(' • ') : undefined}
                badges={
                  <>
                    <StatusBadge
                      label={installStatusLabels[c.installStatus] ?? '—'}
                      variant={installStatusVariants[c.installStatus]}
                    />
                    <StatusBadge
                      label={deliveryStatusLabels[c.deliveryStatus] ?? '—'}
                      variant={deliveryStatusVariants[c.deliveryStatus]}
                    />
                  </>
                }
                meta={
                  <>
                    <span>{c.cableType}</span>
                    <ConsumedTag cable={c} />
                    {c.executorName && <span>مجری: {c.executorName}</span>}
                    <span>{formatJalali(c.date)}</span>
                    <span>روش: {methodLabel(c)}</span>
                    {box && <span>باکس مبدأ: {toFa(box.number)}</span>}
                  </>
                }
                onClick={() => openEdit(c)}
                trailing={<RowMenu name={c.destination} onEdit={() => openEdit(c)} onDelete={() => setDeleteId(c.id)} />}
              />
            )
          })}
        </div>
      )}

      {/* فرم ثبت/ویرایش */}
      <DropCableFormDialog
        open={formOpen}
        editing={editing}
        prefill={prefill}
        projects={projects ?? []}
        routes={routes ?? []}
        boxes={boxes ?? []}
        profiles={profiles ?? []}
        onClose={() => {
          setFormOpen(false)
          setEditing(null)
        }}
        onCreated={(rec) => {
          // پس از ثبت، فرم به حالت ویرایش همان رکورد می‌رود تا عکس با شناسه واقعی ثبت شود
          setEditing(rec)
          toast.success(messages.saved)
        }}
      />

      {/* تأیید حذف */}
      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(o) => {
          if (!o) setDeleteId(null)
        }}
        title="حذف دراپ‌کابل"
        description={`${deleteTarget ? `مقصد «${deleteTarget.destination}» حذف می‌شود. ` : ''}${messages.deleteConfirmDesc}`}
        confirmLabel="حذف"
        destructive
        loading={deleting}
        onConfirm={handleDelete}
      />
    </div>
  )
}

// ================= فرم ثبت/ویرایش دراپ‌کابل =================

interface DropCableFormValues {
  projectId: string
  routeId: string
  sourceBoxId: string
  destination: string
  serviceId: string
  address: string
  date: string
  executorProfileId: string
  cableType: string
  brand: string
  model: string
  coreCount: number | undefined
  initialMeters: number | undefined
  returnedMeters: number | undefined
  consumedUser: number | undefined
  installMethod: InstallMethod
  customMethodLabel: string
  installStatus: InstallStatus
  deliveryStatus: DeliveryStatus
  description: string
}

function defaultFormValues(prefill: { projectId?: string; routeId?: string; sourceBoxId?: string }): DropCableFormValues {
  return {
    projectId: prefill.projectId ?? '',
    routeId: prefill.routeId ?? '',
    sourceBoxId: prefill.sourceBoxId ?? '',
    destination: '',
    serviceId: '',
    address: '',
    date: todayISO(),
    executorProfileId: NONE,
    cableType: '',
    brand: '',
    model: '',
    coreCount: undefined,
    initialMeters: undefined,
    returnedMeters: undefined,
    consumedUser: undefined,
    installMethod: 'aerial',
    customMethodLabel: '',
    installStatus: 'not_installed',
    deliveryStatus: 'not_delivered',
    description: '',
  }
}

function formValuesFromRecord(c: DropCable): DropCableFormValues {
  return {
    projectId: c.projectId,
    routeId: c.routeId ?? '',
    sourceBoxId: c.sourceBoxId ?? '',
    destination: c.destination,
    serviceId: c.serviceId,
    address: c.address,
    date: c.date,
    executorProfileId: c.executorProfileId ?? NONE,
    cableType: c.cableType,
    brand: c.brand,
    model: c.model,
    coreCount: c.coreCount,
    initialMeters: c.initialMeters,
    returnedMeters: c.returnedMeters,
    consumedUser: c.consumedUser,
    installMethod: c.installMethod,
    customMethodLabel: c.customMethodLabel,
    installStatus: c.installStatus,
    deliveryStatus: c.deliveryStatus,
    description: c.description,
  }
}

function DropCableFormDialog({
  open,
  editing,
  prefill,
  projects,
  routes,
  boxes,
  profiles,
  onClose,
  onCreated,
}: {
  open: boolean
  editing: DropCable | null
  prefill: { projectId?: string; routeId?: string; sourceBoxId?: string }
  projects: Project[]
  routes: Route[]
  boxes: Box[]
  profiles: Profile[]
  onClose: () => void
  onCreated: (rec: DropCable) => void
}) {
  const [values, setValues] = React.useState<DropCableFormValues>(() => defaultFormValues(prefill))
  const [errors, setErrors] = React.useState<FormErrors>({})
  const [saving, setSaving] = React.useState(false)
  // بنر موفقیت در حالت ایجاد (دیالوگ باز می‌ماند تا عکس با شناسه واقعی ثبت شود)
  const [justCreated, setJustCreated] = React.useState(false)

  // prefill فقط در زمان بازشدن خوانده می‌شود (ref تا وابستگی اضافه نسازد)
  const prefillRef = React.useRef(prefill)
  prefillRef.current = prefill

  React.useEffect(() => {
    if (!open) return
    setErrors({})
    setValues(editing ? formValuesFromRecord(editing) : defaultFormValues(prefillRef.current))
  }, [open, editing])

  // بنر فقط در نشانیِ بازشدنِ جدید ریست می‌شود؛ بعد از ثبت در همان نشانی باید بماند
  React.useEffect(() => {
    if (!open) return
    setJustCreated(false)
  }, [open])

  const setField = <K extends keyof DropCableFormValues>(key: K, v: DropCableFormValues[K]) => {
    setValues((f) => ({ ...f, [key]: v }))
    setErrors((e) => ({ ...e, [key]: undefined }))
  }

  const formRoutes = React.useMemo(() => routes.filter((r) => r.projectId === values.projectId), [routes, values.projectId])
  const formBoxes = React.useMemo(() => boxes.filter((b) => b.projectId === values.projectId), [boxes, values.projectId])
  const selectedProfile = React.useMemo(
    () => profiles.find((p) => p.id === values.executorProfileId),
    [profiles, values.executorProfileId]
  )

  // پیش‌نمایش زنده متراژ مصرفی (فقط نمایش؛ مقدار ذخیره‌شده در ذخیره محاسبه می‌شود)
  const preview = computeConsumed(values.initialMeters, values.returnedMeters, values.consumedUser)

  const handleSave = async () => {
    const errs: FormErrors = {}
    if (!values.projectId) errs.projectId = 'انتخاب پروژه الزامی است'
    if (!values.destination.trim()) errs.destination = 'مقصد الزامی است'
    if (!values.cableType.trim()) errs.cableType = 'نوع کابل الزامی است'
    if (!values.date) errs.date = 'تاریخ اجرا الزامی است'

    const eInitial = validateMeterage(values.initialMeters, 'متراژ اولیه')
    if (eInitial) errs.initialMeters = eInitial

    const eReturned = validateMeterage(values.returnedMeters, 'متراژ برگشتی')
    if (eReturned) errs.returnedMeters = eReturned
    else if (
      values.initialMeters !== undefined &&
      values.returnedMeters !== undefined &&
      values.returnedMeters > values.initialMeters
    ) {
      errs.returnedMeters = 'متراژ برگشتی نمی‌تواند بیشتر از متراژ اولیه باشد'
    }

    const eUser = validateMeterage(values.consumedUser, 'متراژ مصرفی')
    if (eUser) errs.consumedUser = eUser

    const eCore = validateMeterage(values.coreCount, 'تعداد کور')
    if (eCore) errs.coreCount = eCore

    if (values.installMethod === 'custom' && !values.customMethodLabel.trim()) {
      errs.customMethodLabel = 'عنوان روش اجرای سفارشی الزامی است'
    }

    if (Object.values(errs).some(Boolean)) {
      setErrors(errs)
      toast.error(Object.values(errs).find(Boolean) || messages.requiredMissing)
      return
    }

    // اسنپ‌شات مجری در زمان ثبت
    let executorProfileId: string | undefined
    let executorName: string
    if (selectedProfile) {
      const snap = profileSnapshot(selectedProfile)
      executorProfileId = snap.profileId
      executorName = snap.name
    } else if (values.executorProfileId && values.executorProfileId !== NONE) {
      // پروفایل انتخاب‌شده دیگر موجود نیست — اسنپ‌شات تاریخی حفظ می‌شود
      executorProfileId = values.executorProfileId
      executorName = editing?.executorName ?? ''
    } else {
      // «بدون مجری» — اسنپ‌شات قبلی هم باید پاک شود
      executorProfileId = undefined
      executorName = ''
    }

    // قاعده سلامت داده:
    // - consumedUser دقیقاً همان مقدار واردشده کاربر (یا undefined) — هرگز بازنویسی نمی‌شود
    // - consumedAuto فقط وقتی مقدار کاربر وجود ندارد و ورودی‌ها معتبرند محاسبه می‌شود
    const userProvided = values.consumedUser !== undefined
    const auto = computeConsumed(values.initialMeters, values.returnedMeters, undefined)

    const payload: DropCableInput = {
      projectId: values.projectId,
      routeId: values.routeId || undefined,
      sourceBoxId: values.sourceBoxId || undefined,
      destination: values.destination.trim(),
      serviceId: values.serviceId.trim(),
      address: values.address.trim(),
      date: values.date,
      executorProfileId,
      executorName,
      cableType: values.cableType.trim(),
      brand: values.brand.trim(),
      model: values.model.trim(),
      coreCount: values.coreCount,
      initialMeters: values.initialMeters,
      returnedMeters: values.returnedMeters,
      consumedUser: userProvided ? values.consumedUser : undefined,
      consumedAuto: !userProvided && auto.valid && auto.value !== undefined ? auto.value : undefined,
      installMethod: values.installMethod,
      customMethodLabel: values.installMethod === 'custom' ? values.customMethodLabel.trim() : '',
      installStatus: values.installStatus,
      deliveryStatus: values.deliveryStatus,
      description: values.description.trim(),
    }

    setSaving(true)
    try {
      if (editing) {
        await updateDropCable(editing.id, payload)
        toast.success(messages.updated)
        onClose()
      } else {
        const rec = await createDropCable(payload)
        onCreated(rec)
        setJustCreated(true)
      }
    } catch {
      toast.error(messages.error)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose()
      }}
    >
      <DialogContent className="flex max-h-[92dvh] max-w-lg flex-col gap-0 overflow-hidden p-0" dir="rtl">
        <DialogHeader className="gap-1 border-b p-4 text-right">
          <DialogTitle className="text-base">{editing ? 'ویرایش دراپ‌کابل' : 'ثبت دراپ‌کابل'}</DialogTitle>
          <DialogDescription className="text-xs">
            مشخصات اجرا، متراژها و وضعیت نصب/تحویل را وارد کنید
          </DialogDescription>
        </DialogHeader>

        <form
          id="drop-cable-form"
          onSubmit={(e) => {
            e.preventDefault()
            handleSave()
          }}
          className="flex flex-col gap-3 overflow-y-auto p-4"
        >
          {justCreated && (
            <div
              role="status"
              className="rounded-lg border border-primary/30 bg-primary/10 px-3 py-2.5 text-sm font-medium text-primary"
            >
              ذخیره شد ✓ — اکنون می‌توانید برای این مورد عکس ثبت کنید یا مشخصات را تکمیل کنید
            </div>
          )}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="پروژه" required error={errors.projectId}>
              <Select
                value={values.projectId || undefined}
                onValueChange={(v) => {
                  setValues((f) => ({ ...f, projectId: v, routeId: '', sourceBoxId: '' }))
                  setErrors((e) => ({ ...e, projectId: undefined }))
                }}
              >
                <SelectTrigger className="min-h-11 w-full" aria-label="انتخاب پروژه">
                  <SelectValue placeholder="انتخاب پروژه" />
                </SelectTrigger>
                <SelectContent dir="rtl">
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field
              label="مسیر"
              hint={values.projectId ? undefined : 'ابتدا پروژه را انتخاب کنید'}
            >
              <Select
                value={values.routeId || undefined}
                disabled={!values.projectId}
                onValueChange={(v) => setField('routeId', v === NONE ? '' : v)}
              >
                <SelectTrigger className="min-h-11 w-full" aria-label="انتخاب مسیر">
                  <SelectValue placeholder="بدون مسیر" />
                </SelectTrigger>
                <SelectContent dir="rtl">
                  <SelectItem value={NONE}>— بدون مسیر —</SelectItem>
                  {formRoutes.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label="باکس مبدأ">
              <Select
                value={values.sourceBoxId || undefined}
                disabled={!values.projectId}
                onValueChange={(v) => setField('sourceBoxId', v === NONE ? '' : v)}
              >
                <SelectTrigger className="min-h-11 w-full" aria-label="انتخاب باکس مبدأ">
                  <SelectValue placeholder="بدون باکس مبدأ" />
                </SelectTrigger>
                <SelectContent dir="rtl">
                  <SelectItem value={NONE}>— بدون باکس مبدأ —</SelectItem>
                  {formBoxes.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      باکس {toFa(b.number)}
                      {b.location ? ` — ${b.location}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label="تاریخ اجرا" required error={errors.date}>
              <JalaliDatePicker value={values.date || undefined} onChange={(iso) => setField('date', iso ?? '')} />
            </Field>

            <Field label="مقصد" required error={errors.destination} className="sm:col-span-2">
              <Input
                value={values.destination}
                onChange={(e) => setField('destination', e.target.value)}
                placeholder="مثلاً: منزل مشترک — واحدهای ۲ و ۳"
                className="min-h-11"
              />
            </Field>

            <Field label="شناسه سرویس/مشترک">
              <Input
                value={values.serviceId}
                onChange={(e) => setField('serviceId', e.target.value)}
                placeholder="اختیاری"
                className="min-h-11"
                dir="ltr"
              />
            </Field>

            <Field label="مجری" hint="نام و نقش در زمان ثبت ذخیره می‌شود">
              <Select
                value={values.executorProfileId || undefined}
                onValueChange={(v) => setField('executorProfileId', v === NONE ? '' : v)}
              >
                <SelectTrigger className="min-h-11 w-full" aria-label="انتخاب مجری">
                  <SelectValue placeholder="بدون مجری" />
                </SelectTrigger>
                <SelectContent dir="rtl">
                  <SelectItem value={NONE}>— بدون مجری —</SelectItem>
                  {profiles.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {`${p.firstName} ${p.lastName}`.trim()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label="آدرس" className="sm:col-span-2">
              <Input
                value={values.address}
                onChange={(e) => setField('address', e.target.value)}
                placeholder="اختیاری"
                className="min-h-11"
              />
            </Field>

            <Field label="نوع کابل" required error={errors.cableType}>
              <Input
                value={values.cableType}
                onChange={(e) => setField('cableType', e.target.value)}
                placeholder="مثلاً: دراپ ۲ کور"
                className="min-h-11"
              />
            </Field>

            <Field label="برند">
              <Input
                value={values.brand}
                onChange={(e) => setField('brand', e.target.value)}
                placeholder="اختیاری"
                className="min-h-11"
              />
            </Field>

            <Field label="مدل">
              <Input
                value={values.model}
                onChange={(e) => setField('model', e.target.value)}
                placeholder="اختیاری"
                className="min-h-11"
              />
            </Field>

            <Field label="تعداد کور" error={errors.coreCount}>
              <NumberField
                value={values.coreCount}
                onChange={(v) => setField('coreCount', v)}
                unit="کور"
                placeholder="اختیاری"
                allowNegative={false}
              />
            </Field>

            <Field label="متراژ اولیه" error={errors.initialMeters}>
              <NumberField
                value={values.initialMeters}
                onChange={(v) => setField('initialMeters', v)}
                unit="متر"
                placeholder="اختیاری"
                allowNegative={false}
              />
            </Field>

            <Field label="متراژ برگشتی" error={errors.returnedMeters}>
              <NumberField
                value={values.returnedMeters}
                onChange={(v) => setField('returnedMeters', v)}
                unit="متر"
                placeholder="اختیاری"
                allowNegative={false}
              />
            </Field>

            <Field
              label="متراژ مصرفی (واردشده توسط کاربر)"
              error={errors.consumedUser}
              hint="در صورت واردکردن، همین مقدار بدون تغییر ذخیره می‌شود"
              className="sm:col-span-2"
            >
              <NumberField
                value={values.consumedUser}
                onChange={(v) => setField('consumedUser', v)}
                unit="متر"
                placeholder="اختیاری"
                allowNegative={false}
              />
            </Field>

            {/* پیش‌نمایش زنده محاسبه مصرف */}
            <div className="rounded-xl bg-primary/5 p-3 text-sm sm:col-span-2" aria-live="polite">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-muted-foreground">متراژ مصرفی:</span>
                {preview.valid && preview.value !== undefined ? (
                  <>
                    <span className="font-bold tabular-nums">{formatMeters(preview.value)}</span>
                    <StatusBadge
                      label={preview.source === 'user' ? 'واردشده توسط کاربر' : 'محاسباتی'}
                      variant={preview.source === 'user' ? 'outline' : 'secondary'}
                    />
                  </>
                ) : (
                  <span
                    className={cn(
                      'text-xs',
                      preview.message ? 'font-medium text-amber-600 dark:text-amber-400' : 'text-muted-foreground'
                    )}
                  >
                    {preview.message ?? '—'}
                  </span>
                )}
              </div>
            </div>

            <Field label="روش اجرا">
              <Select value={values.installMethod} onValueChange={(v) => setField('installMethod', v as InstallMethod)}>
                <SelectTrigger className="min-h-11 w-full" aria-label="روش اجرا">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent dir="rtl">
                  {(Object.keys(installMethodLabels) as InstallMethod[]).map((m) => (
                    <SelectItem key={m} value={m}>
                      {installMethodLabels[m]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label="وضعیت نصب">
              <Select value={values.installStatus} onValueChange={(v) => setField('installStatus', v as InstallStatus)}>
                <SelectTrigger className="min-h-11 w-full" aria-label="وضعیت نصب">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent dir="rtl">
                  {(Object.keys(installStatusLabels) as InstallStatus[]).map((s) => (
                    <SelectItem key={s} value={s}>
                      {installStatusLabels[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            {values.installMethod === 'custom' && (
              <Field label="عنوان روش سفارشی" required error={errors.customMethodLabel} className="sm:col-span-2">
                <Input
                  value={values.customMethodLabel}
                  onChange={(e) => setField('customMethodLabel', e.target.value)}
                  placeholder="مثلاً: اجرای ترکیبی از نما و کانال"
                  className="min-h-11"
                />
              </Field>
            )}

            <Field label="وضعیت تحویل" className="sm:col-span-2">
              <Select
                value={values.deliveryStatus}
                onValueChange={(v) => setField('deliveryStatus', v as DeliveryStatus)}
              >
                <SelectTrigger className="min-h-11 w-full" aria-label="وضعیت تحویل">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent dir="rtl">
                  {(Object.keys(deliveryStatusLabels) as DeliveryStatus[]).map((s) => (
                    <SelectItem key={s} value={s}>
                      {deliveryStatusLabels[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label="توضیحات" className="sm:col-span-2">
              <Textarea
                value={values.description}
                onChange={(e) => setField('description', e.target.value)}
                rows={3}
                placeholder="اختیاری"
              />
            </Field>

            {/* عکس‌ها — فقط در حالت ویرایش (رکورد باید شناسه داشته باشد) */}
            {editing && (
              <section className="flex flex-col gap-3 rounded-xl border p-3 sm:col-span-2" aria-label="عکس‌های دراپ‌کابل">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold">عکس‌های دراپ‌کابل</h3>
                  <PhotoPickerButton
                    link={{
                      projectId: values.projectId || editing.projectId,
                      routeId: values.routeId || undefined,
                      boxId: values.sourceBoxId || undefined,
                      dropCableId: editing.id,
                    }}
                    category="drop_cable"
                    baseTitle={`دراپ‌کابل ${values.destination.trim() || editing.destination}`}
                    label="افزودن عکس دراپ‌کابل"
                    size="sm"
                  />
                </div>
                <PhotoGallery filter={{ dropCableId: editing.id }} emptyHint="عکسی برای این دراپ‌کابل ثبت نشده است." />
              </section>
            )}
          </div>
        </form>

        <DialogFooter className="flex-row justify-start gap-2 border-t p-4">
          <Button type="submit" form="drop-cable-form" disabled={saving} className="min-h-11 flex-1">
            {saving ? 'در حال ذخیره…' : 'ذخیره'}
          </Button>
          <Button variant="outline" type="button" onClick={onClose} disabled={saving} className="min-h-11 flex-1">
            انصراف
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
