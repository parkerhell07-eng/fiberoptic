'use client'

// فایبرکار — جزئیات پروژه (خلاصه، مسیرها، باکس‌ها، عملیات، عکس‌ها)
import * as React from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  Archive,
  ArchiveRestore,
  Boxes,
  Cable,
  ClipboardList,
  FileDown,
  Gauge,
  Images,
  Loader2,
  MoreVertical,
  Pencil,
  Plus,
  Ruler,
  Sparkles,
  Trash2,
  Waypoints,
} from 'lucide-react'
import { toast } from 'sonner'
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import {
  ConfirmDialog,
  EmptyState,
  Field,
  InfoRow,
  ItemCard,
  JalaliDatePicker,
  PageHeader,
  SegmentedTabs,
  StatCard,
  StatusBadge,
} from '@/components/fiberkar/primitives'
import { PhotoPickerButton } from '@/components/fiberkar/photo-picker'
import { PhotoGallery } from '@/components/fiberkar/photo-gallery'
import { useAppStore } from '@/store/app-store'
import {
  createBox,
  createRoute,
  db,
  deleteBoxCascade,
  deleteProjectCascade,
  deleteRouteCascade,
  getProjectStats,
  setBoxArchived,
  setProjectArchived,
  setRouteArchived,
  updateBox,
  updateProject,
  updateRoute,
  type BoxInput,
  type ProjectInput,
  type RouteInput,
} from '@/lib/localdb'
import {
  boxStatusLabels,
  boxStatusVariants,
  messages,
  operationStatusLabels,
  operationStatusVariants,
  operationTypeLabels,
  projectStatusLabels,
  projectStatusVariants,
} from '@/lib/labels'
import { formatJalali, formatJalaliDateTime, formatMeters, toFa } from '@/lib/persian'
import type { Box, BoxStatus, Profile, Project, ProjectStatus, Route } from '@/lib/types'

// ---------- ابزار مشترک ----------
function profileDisplayName(p: Profile): string {
  const name = `${p.firstName} ${p.lastName}`.trim()
  return name || p.company || 'بدون نام'
}

function CenterSpinner() {
  return (
    <div className="flex justify-center py-16">
      <Loader2 className="size-6 animate-spin text-muted-foreground" aria-label="در حال بارگذاری" />
    </div>
  )
}

// ---------- فرم پروژه (محلی) ----------
interface ProjectFormValues {
  name: string
  code: string
  client: string
  area: string
  startDate?: string
  status: ProjectStatus
  contractorProfileId?: string
  executorProfileId?: string
  description: string
}

const EMPTY_PROJECT_FORM: ProjectFormValues = {
  name: '',
  code: '',
  client: '',
  area: '',
  startDate: undefined,
  status: 'in_progress',
  contractorProfileId: undefined,
  executorProfileId: undefined,
  description: '',
}

function ProjectEditDialog({
  open,
  onOpenChange,
  editing,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** اسنپ‌شات پروژه در زمان بازشدن — هرگز آبجکت زنده liveQuery نیست */
  editing: Project | null
}) {
  const [form, setForm] = React.useState<ProjectFormValues>(EMPTY_PROJECT_FORM)
  const [errors, setErrors] = React.useState<{ name?: string; client?: string }>({})
  const [saving, setSaving] = React.useState(false)

  const profiles = useLiveQuery(async () => {
    const ps = await db.profiles.toArray()
    return ps.sort((a, b) => profileDisplayName(a).localeCompare(profileDisplayName(b)))
  }, [])

  React.useEffect(() => {
    if (!open || !editing) return
    setForm({
      name: editing.name,
      code: editing.code,
      client: editing.client,
      area: editing.area,
      startDate: editing.startDate,
      status: editing.status,
      contractorProfileId: editing.contractorProfileId,
      executorProfileId: editing.executorProfileId,
      description: editing.description,
    })
    setErrors({})
  }, [open, editing])

  function set<K extends keyof ProjectFormValues>(key: K, value: ProjectFormValues[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function handleSave() {
    const errs: { name?: string; client?: string } = {}
    if (!form.name.trim()) errs.name = 'نام پروژه الزامی است'
    if (!form.client.trim()) errs.client = 'نام کارفرما الزامی است'
    setErrors(errs)
    if (Object.keys(errs).length > 0) return
    setSaving(true)
    try {
      const input: ProjectInput = {
        name: form.name.trim(),
        code: form.code.trim(),
        client: form.client.trim(),
        area: form.area.trim(),
        startDate: form.startDate,
        status: form.status,
        contractorProfileId: form.contractorProfileId || undefined,
        executorProfileId: form.executorProfileId || undefined,
        description: form.description.trim(),
      }
      if (editing) {
        await updateProject(editing.id, input)
        toast.success(messages.updated)
      }
      onOpenChange(false)
    } catch {
      toast.error(messages.error)
    } finally {
      setSaving(false)
    }
  }

  // در صفحه جزئیات، فرم پروژه فقط برای ویرایش استفاده می‌شود.

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="max-w-lg">
        <form
          id="project-edit-form"
          onSubmit={(e) => {
            e.preventDefault()
            handleSave()
          }}
          className="flex flex-col gap-4"
        >
        <DialogHeader>
          <DialogTitle>ویرایش پروژه</DialogTitle>
          <DialogDescription>اطلاعات پروژه را ویرایش کنید؛ فیلدهای ستاره‌دار الزامی هستند.</DialogDescription>
        </DialogHeader>
        <div className="grid max-h-[60vh] gap-4 overflow-y-auto pe-1">
          <Field label="نام پروژه" required error={errors.name}>
            <Input value={form.name} onChange={(e) => set('name', e.target.value)} className="min-h-11" />
          </Field>
          <Field label="کد پروژه" hint="اختیاری">
            <Input value={form.code} onChange={(e) => set('code', e.target.value)} className="min-h-11" dir="ltr" />
          </Field>
          <Field label="کارفرما" required error={errors.client}>
            <Input value={form.client} onChange={(e) => set('client', e.target.value)} className="min-h-11" />
          </Field>
          <Field label="محدوده" hint="اختیاری">
            <Input value={form.area} onChange={(e) => set('area', e.target.value)} className="min-h-11" />
          </Field>
          <Field label="تاریخ شروع" hint="اختیاری">
            <JalaliDatePicker value={form.startDate} onChange={(iso) => set('startDate', iso)} placeholder="انتخاب تاریخ شروع" />
          </Field>
          <Field label="وضعیت">
            <Select value={form.status} onValueChange={(v) => set('status', v as ProjectStatus)}>
              <SelectTrigger className="min-h-11 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent dir="rtl">
                {(Object.entries(projectStatusLabels) as Array<[ProjectStatus, string]>).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="پیمانکار" hint="اختیاری — از پروفایل‌ها">
            <Select
              value={form.contractorProfileId ?? 'none'}
              onValueChange={(v) => set('contractorProfileId', v === 'none' ? undefined : v)}
            >
              <SelectTrigger className="min-h-11 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent dir="rtl">
                <SelectItem value="none">بدون انتخاب</SelectItem>
                {(profiles ?? []).map((pr) => (
                  <SelectItem key={pr.id} value={pr.id}>
                    {profileDisplayName(pr)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="مجری" hint="اختیاری — از پروفایل‌ها">
            <Select
              value={form.executorProfileId ?? 'none'}
              onValueChange={(v) => set('executorProfileId', v === 'none' ? undefined : v)}
            >
              <SelectTrigger className="min-h-11 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent dir="rtl">
                <SelectItem value="none">بدون انتخاب</SelectItem>
                {(profiles ?? []).map((pr) => (
                  <SelectItem key={pr.id} value={pr.id}>
                    {profileDisplayName(pr)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="توضیحات">
            <Textarea value={form.description} onChange={(e) => set('description', e.target.value)} className="min-h-20" />
          </Field>
        </div>
        <DialogFooter className="flex-row justify-start gap-2">
          <Button type="submit" form="project-edit-form" disabled={saving} className="min-h-11 flex-1">
            {saving ? 'در حال ذخیره…' : 'ذخیره'}
          </Button>
          <Button variant="outline" type="button" onClick={() => onOpenChange(false)} disabled={saving} className="min-h-11 flex-1">
            انصراف
          </Button>
        </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ---------- فرم مسیر ----------
interface RouteFormValues {
  name: string
  code: string
  description: string
}

function RouteFormDialog({
  open,
  onOpenChange,
  projectId,
  editing,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectId: string
  editing: Route | null
}) {
  const [form, setForm] = React.useState<RouteFormValues>({ name: '', code: '', description: '' })
  const [error, setError] = React.useState<string | null>(null)
  const [saving, setSaving] = React.useState(false)

  React.useEffect(() => {
    if (open) {
      setForm(editing ? { name: editing.name, code: editing.code, description: editing.description } : { name: '', code: '', description: '' })
      setError(null)
    }
  }, [open, editing])

  async function handleSave() {
    if (!form.name.trim()) {
      setError('نام مسیر الزامی است')
      return
    }
    setSaving(true)
    try {
      const input: RouteInput = {
        projectId,
        name: form.name.trim(),
        code: form.code.trim(),
        description: form.description.trim(),
      }
      if (editing) {
        await updateRoute(editing.id, input)
        toast.success(messages.updated)
      } else {
        await createRoute(input)
        toast.success(messages.saved)
      }
      onOpenChange(false)
    } catch {
      toast.error(messages.error)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="max-w-lg">
        <form
          id="route-form"
          onSubmit={(e) => {
            e.preventDefault()
            handleSave()
          }}
          className="flex flex-col gap-4"
        >
        <DialogHeader>
          <DialogTitle>{editing ? 'ویرایش مسیر' : 'مسیر جدید'}</DialogTitle>
          <DialogDescription>مسیر شبکه را تعریف کنید؛ هر مسیر می‌تواند چند باکس داشته باشد.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <Field label="نام مسیر" required error={error}>
            <Input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="مثلاً فیدر اصلی خیابان ولیعصر"
              className="min-h-11"
            />
          </Field>
          <Field label="کد مسیر" hint="اختیاری">
            <Input
              value={form.code}
              onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
              placeholder="مثلاً RT-01"
              className="min-h-11"
              dir="ltr"
            />
          </Field>
          <Field label="توضیحات">
            <Textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="توضیحات مسیر…"
              className="min-h-20"
            />
          </Field>
        </div>
        <DialogFooter className="flex-row justify-start gap-2">
          <Button type="submit" form="route-form" disabled={saving} className="min-h-11 flex-1">
            {saving ? 'در حال ذخیره…' : 'ذخیره'}
          </Button>
          <Button variant="outline" type="button" onClick={() => onOpenChange(false)} disabled={saving} className="min-h-11 flex-1">
            انصراف
          </Button>
        </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ---------- فرم باکس ----------
interface BoxFormValues {
  number: string
  location: string
  cableSpec: string
  capacity: string
  status: BoxStatus
  routeId: string
  description: string
}

function BoxFormDialog({
  open,
  onOpenChange,
  projectId,
  routes,
  defaultRouteId,
  editing,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectId: string
  routes: Route[]
  defaultRouteId?: string
  editing: Box | null
}) {
  const [form, setForm] = React.useState<BoxFormValues>({
    number: '',
    location: '',
    cableSpec: '',
    capacity: '',
    status: 'not_installed',
    routeId: defaultRouteId ?? '',
    description: '',
  })
  const [errors, setErrors] = React.useState<{ number?: string; routeId?: string }>({})
  const [saving, setSaving] = React.useState(false)

  React.useEffect(() => {
    if (open) {
      setForm(
        editing
          ? {
              number: editing.number,
              location: editing.location,
              cableSpec: editing.cableSpec,
              capacity: editing.capacity,
              status: editing.status,
              routeId: editing.routeId,
              description: editing.description,
            }
          : {
              number: '',
              location: '',
              cableSpec: '',
              capacity: '',
              status: 'not_installed',
              routeId: defaultRouteId ?? '',
              description: '',
            }
      )
      setErrors({})
    }
  }, [open, editing, defaultRouteId])

  async function handleSave() {
    const errs: { number?: string; routeId?: string } = {}
    if (!form.number.trim()) errs.number = 'شماره باکس الزامی است'
    if (!form.routeId) errs.routeId = 'انتخاب مسیر الزامی است'
    setErrors(errs)
    if (Object.keys(errs).length > 0) return
    setSaving(true)
    try {
      const input: BoxInput = {
        projectId,
        routeId: form.routeId,
        number: form.number.trim(),
        location: form.location.trim(),
        cableSpec: form.cableSpec.trim(),
        capacity: form.capacity.trim(),
        status: form.status,
        description: form.description.trim(),
      }
      if (editing) {
        await updateBox(editing.id, input)
        toast.success(messages.updated)
      } else {
        await createBox(input)
        toast.success(messages.saved)
      }
      onOpenChange(false)
    } catch {
      toast.error(messages.error)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="max-w-lg">
        <form
          id="box-form"
          onSubmit={(e) => {
            e.preventDefault()
            handleSave()
          }}
          className="flex flex-col gap-4"
        >
        <DialogHeader>
          <DialogTitle>{editing ? 'ویرایش باکس' : 'باکس جدید'}</DialogTitle>
          <DialogDescription>مشخصات باکس فیبر را وارد کنید؛ شماره باکس و مسیر الزامی هستند.</DialogDescription>
        </DialogHeader>
        <div className="grid max-h-[60vh] gap-4 overflow-y-auto pe-1">
          <Field label="شماره باکس" required error={errors.number}>
            <Input
              value={form.number}
              onChange={(e) => setForm((f) => ({ ...f, number: e.target.value }))}
              placeholder="مثلاً B-12"
              className="min-h-11"
              dir="ltr"
            />
          </Field>
          <Field label="مسیر" required error={errors.routeId}>
            <Select value={form.routeId || undefined} onValueChange={(v) => setForm((f) => ({ ...f, routeId: v }))}>
              <SelectTrigger className="min-h-11 w-full">
                <SelectValue placeholder="انتخاب مسیر" />
              </SelectTrigger>
              <SelectContent dir="rtl">
                {routes.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.name}
                    {r.archived === 1 ? ' (آرشیو)' : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="محل نصب" hint="اختیاری">
            <Input
              value={form.location}
              onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
              placeholder="مثلاً تیر چراغ برق پلاک ۲۴"
              className="min-h-11"
            />
          </Field>
          <Field label="مشخصات کابل" hint="اختیاری">
            <Input
              value={form.cableSpec}
              onChange={(e) => setForm((f) => ({ ...f, cableSpec: e.target.value }))}
              placeholder="مثلاً 24 کور آزمایش‌شده"
              className="min-h-11"
            />
          </Field>
          <Field label="ظرفیت" hint="اختیاری — مثلاً 1x8">
            <Input
              value={form.capacity}
              onChange={(e) => setForm((f) => ({ ...f, capacity: e.target.value }))}
              placeholder="مثلاً 1x8"
              className="min-h-11"
              dir="ltr"
            />
          </Field>
          <Field label="وضعیت">
            <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v as BoxStatus }))}>
              <SelectTrigger className="min-h-11 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent dir="rtl">
                {(Object.entries(boxStatusLabels) as Array<[BoxStatus, string]>).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="توضیحات">
            <Textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              className="min-h-20"
            />
          </Field>
        </div>
        <DialogFooter className="flex-row justify-start gap-2">
          <Button type="submit" form="box-form" disabled={saving} className="min-h-11 flex-1">
            {saving ? 'در حال ذخیره…' : 'ذخیره'}
          </Button>
          <Button variant="outline" type="button" onClick={() => onOpenChange(false)} disabled={saving} className="min-h-11 flex-1">
            انصراف
          </Button>
        </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ---------- منوی عمومی ردیف‌ها ----------
function RowMenu({
  label,
  archived,
  onEdit,
  onArchive,
  onDelete,
  onClick,
}: {
  label: string
  archived: 0 | 1
  onEdit: () => void
  onArchive: () => void
  onDelete: () => void
  onClick?: (e: React.MouseEvent) => void
}) {
  return (
    <DropdownMenu dir="rtl">
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="size-11" aria-label={`گزینه‌های ${label}`} onClick={(e) => { e.stopPropagation(); onClick?.(e) }}>
          <MoreVertical className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" onClick={(e) => e.stopPropagation()}>
        <DropdownMenuItem onClick={onEdit}>
          <Pencil className="size-4" />
          ویرایش
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onArchive}>
          {archived === 1 ? <ArchiveRestore className="size-4" /> : <Archive className="size-4" />}
          {archived === 1 ? 'خروج از آرشیو' : 'آرشیو'}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={onDelete}>
          <Trash2 className="size-4" />
          حذف
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// ---------- نمای اصلی ----------
type ProjectTab = 'summary' | 'routes' | 'boxes' | 'operations' | 'photos'

export default function ProjectDetailView() {
  const params = useAppStore((s) => s.params)
  const navigate = useAppStore((s) => s.navigate)
  const replace = useAppStore((s) => s.replace)
  const back = useAppStore((s) => s.back)
  const projectId = params.projectId

  const project = useLiveQuery<Project | null>(async () => (projectId ? (await db.projects.get(projectId)) ?? null : null), [projectId])
  const stats = useLiveQuery(async () => (projectId ? getProjectStats(projectId) : undefined), [projectId])
  const profiles = useLiveQuery(() => db.profiles.toArray(), [])

  const routes = useLiveQuery(async () => {
    if (!projectId) return []
    const rs = await db.routes.where('projectId').equals(projectId).filter((r) => !r.archived).toArray()
    return rs.sort((a, b) => b.createdAt - a.createdAt)
  }, [projectId])

  const allRoutes = useLiveQuery(async () => {
    if (!projectId) return []
    const rs = await db.routes.where('projectId').equals(projectId).toArray()
    return rs.sort((a, b) => a.createdAt - b.createdAt)
  }, [projectId])

  const boxes = useLiveQuery(async () => {
    if (!projectId) return []
    const bs = await db.boxes.where('projectId').equals(projectId).filter((b) => !b.archived).toArray()
    return bs.sort((a, b) => b.createdAt - a.createdAt)
  }, [projectId])

  const operations = useLiveQuery(async () => {
    if (!projectId) return []
    const ops = await db.operations.where('projectId').equals(projectId).toArray()
    return ops.sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt)
  }, [projectId])

  // وضعیت‌های محلی
  const [tab, setTab] = React.useState<ProjectTab>('summary')
  const [projectDialogOpen, setProjectDialogOpen] = React.useState(false)
  // اسنپ‌شات پروژه در زمان بازشدن فرم ویرایش (رکورد زنده liveQuery به فرم داده نمی‌شود)
  const [editingProject, setEditingProject] = React.useState<Project | null>(null)
  const [routeDialogOpen, setRouteDialogOpen] = React.useState(false)
  const [editingRoute, setEditingRoute] = React.useState<Route | null>(null)
  const [routeDeleteTarget, setRouteDeleteTarget] = React.useState<Route | null>(null)
  const [boxDialogOpen, setBoxDialogOpen] = React.useState(false)
  const [editingBox, setEditingBox] = React.useState<Box | null>(null)
  const [boxDeleteTarget, setBoxDeleteTarget] = React.useState<Box | null>(null)
  const [projectDeleteOpen, setProjectDeleteOpen] = React.useState(false)
  const [deleting, setDeleting] = React.useState(false)
  const [routeDeleting, setRouteDeleting] = React.useState(false)
  const [boxDeleting, setBoxDeleting] = React.useState(false)

  const boxCountByRoute = React.useMemo(() => {
    const m: Record<string, number> = {}
    for (const b of boxes ?? []) m[b.routeId] = (m[b.routeId] ?? 0) + 1
    return m
  }, [boxes])

  const profileById = React.useMemo(() => {
    const m: Record<string, Profile> = {}
    for (const p of profiles ?? []) m[p.id] = p
    return m
  }, [profiles])

  // ---------- گاردها ----------
  if (!projectId) {
    return (
      <EmptyState
        title="پروژه‌ای انتخاب نشده است"
        hint="از فهرست پروژه‌ها یک پروژه را انتخاب کنید."
        actionLabel="فهرست پروژه‌ها"
        onAction={() => navigate('projects')}
      />
    )
  }
  if (project === undefined) return <CenterSpinner />
  if (project === null) {
    return (
      <EmptyState
        title="پروژه یافت نشد"
        hint="ممکن است این پروژه حذف شده باشد."
        actionLabel="فهرست پروژه‌ها"
        onAction={() => navigate('projects')}
      />
    )
  }

  const subtitle = [project.code ? `کد: ${toFa(project.code)}` : null, project.client, project.area].filter(Boolean).join(' • ')

  async function handleProjectDelete() {
    if (!projectId) return
    setDeleting(true)
    try {
      await deleteProjectCascade(projectId)
      toast.success(messages.deleted)
      setProjectDeleteOpen(false)
      // replace: Back نباید به پروژه حذف‌شده برگردد
      replace('projects')
    } catch {
      toast.error(messages.error)
    } finally {
      setDeleting(false)
    }
  }

  async function handleRouteDelete() {
    if (!routeDeleteTarget) return
    setRouteDeleting(true)
    try {
      await deleteRouteCascade(routeDeleteTarget.id)
      toast.success(messages.deleted)
      setRouteDeleteTarget(null)
    } catch {
      toast.error(messages.error)
    } finally {
      setRouteDeleting(false)
    }
  }

  async function handleBoxDelete() {
    if (!boxDeleteTarget) return
    setBoxDeleting(true)
    try {
      await deleteBoxCascade(boxDeleteTarget.id)
      toast.success(messages.deleted)
      setBoxDeleteTarget(null)
    } catch {
      toast.error(messages.error)
    } finally {
      setBoxDeleting(false)
    }
  }

  const contractorName = project.contractorProfileId ? profileById[project.contractorProfileId] : undefined
  const executorName = project.executorProfileId ? profileById[project.executorProfileId] : undefined

  return (
    <div className="space-y-4">
      <PageHeader
        title={project.name}
        subtitle={subtitle}
        onBack={back}
        actions={
          <>
            <Button variant="outline" size="sm" className="min-h-11" onClick={() => navigate('reports', { projectId })}>
              <FileDown className="size-4" />
              گزارش PDF
            </Button>
            <Button variant="outline" size="icon" className="size-11" aria-label="ویرایش پروژه" onClick={() => {
              setEditingProject(project)
              setProjectDialogOpen(true)
            }}>
              <Pencil className="size-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="size-11"
              aria-label={project.archived === 1 ? 'خروج از آرشیو' : 'آرشیو پروژه'}
              onClick={async () => {
                try {
                  if (project.archived === 1) {
                    await setProjectArchived(project.id, 0)
                    toast.success(messages.unarchived)
                  } else {
                    await setProjectArchived(project.id, 1)
                    toast.success(messages.archived)
                  }
                } catch {
                  toast.error(messages.error)
                }
              }}
            >
              {project.archived === 1 ? <ArchiveRestore className="size-4" /> : <Archive className="size-4" />}
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="size-11 text-destructive"
              aria-label="حذف پروژه"
              onClick={() => setProjectDeleteOpen(true)}
            >
              <Trash2 className="size-4" />
            </Button>
          </>
        }
      />

      {/* آمار پروژه */}
      {stats === undefined ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[76px] rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="مسیرها" value={toFa(stats.routes)} icon={<Waypoints className="size-4" />} onClick={() => setTab('routes')} />
          <StatCard label="باکس‌ها" value={toFa(stats.boxes)} icon={<Boxes className="size-4" />} onClick={() => setTab('boxes')} />
          <StatCard label="عملیات" value={toFa(stats.operations)} icon={<ClipboardList className="size-4" />} onClick={() => setTab('operations')} />
          <StatCard label="فیوژن‌ها" value={toFa(stats.fusions)} icon={<Sparkles className="size-4" />} />
          <StatCard label="تست‌های توان" value={toFa(stats.powerTests)} icon={<Gauge className="size-4" />} />
          <StatCard label="دراپ‌کابل‌ها" value={toFa(stats.dropCables)} icon={<Cable className="size-4" />} />
          <StatCard label="عکس‌ها" value={toFa(stats.photos)} icon={<Images className="size-4" />} onClick={() => setTab('photos')} />
          <StatCard label="متراژ مصرفی" value={formatMeters(stats.consumedMeters)} icon={<Ruler className="size-4" />} tone="amber" />
        </div>
      )}

      <SegmentedTabs
        value={tab}
        onChange={(v) => setTab(v as ProjectTab)}
        options={[
          { value: 'summary', label: 'خلاصه' },
          { value: 'routes', label: 'مسیرها' },
          { value: 'boxes', label: 'باکس‌ها' },
          { value: 'operations', label: 'عملیات' },
          { value: 'photos', label: 'عکس‌ها' },
        ]}
      />

      {/* ---------- خلاصه ---------- */}
      {tab === 'summary' && (
        <div className="rounded-xl border p-4">
          <div>
            <InfoRow label="وضعیت" value={<StatusBadge label={projectStatusLabels[project.status]} variant={projectStatusVariants[project.status]} />} />
            <InfoRow label="کارفرما" value={project.client || '—'} />
            <InfoRow label="محدوده" value={project.area || '—'} />
            <InfoRow label="تاریخ شروع" value={project.startDate ? formatJalali(project.startDate) : '—'} />
            <InfoRow label="پیمانکار" value={contractorName ? profileDisplayName(contractorName) : '—'} />
            <InfoRow label="مجری" value={executorName ? profileDisplayName(executorName) : '—'} />
            <InfoRow label="توضیحات" value={project.description || '—'} />
            <InfoRow label="تاریخ ثبت" value={formatJalaliDateTime(project.createdAt)} />
          </div>
        </div>
      )}

      {/* ---------- مسیرها ---------- */}
      {tab === 'routes' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-muted-foreground">
              مسیرهای پروژه {routes !== undefined ? `(${toFa(routes.length)})` : ''}
            </h2>
            <Button
              variant="outline"
              size="sm"
              className="min-h-11"
              onClick={() => {
                setEditingRoute(null)
                setRouteDialogOpen(true)
              }}
            >
              <Plus className="size-4" />
              مسیر جدید
            </Button>
          </div>
          {routes === undefined ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-16 rounded-xl" />
              ))}
            </div>
          ) : routes.length === 0 ? (
            <EmptyState
              title="مسیری ثبت نشده است"
              hint="مسیرها خطوط اصلی شبکه پروژه هستند؛ برای شروع یک مسیر بسازید."
              actionLabel="مسیر جدید"
              onAction={() => {
                setEditingRoute(null)
                setRouteDialogOpen(true)
              }}
            />
          ) : (
            <div className="space-y-3">
              {routes.map((r) => (
                <ItemCard
                  key={r.id}
                  title={r.name}
                  subtitle={r.code ? `کد: ${toFa(r.code)}` : undefined}
                  meta={<span>{toFa(boxCountByRoute[r.id] ?? 0)} باکس</span>}
                  onClick={() => navigate('route', { projectId, routeId: r.id })}
                  trailing={
                    <RowMenu
                      label={`مسیر ${r.name}`}
                      archived={r.archived}
                      onEdit={() => {
                        setEditingRoute(r)
                        setRouteDialogOpen(true)
                      }}
                      onArchive={async () => {
                        try {
                          await setRouteArchived(r.id, r.archived === 1 ? 0 : 1)
                          toast.success(r.archived === 1 ? messages.unarchived : messages.archived)
                        } catch {
                          toast.error(messages.error)
                        }
                      }}
                      onDelete={() => setRouteDeleteTarget(r)}
                    />
                  }
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ---------- باکس‌ها ---------- */}
      {tab === 'boxes' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-muted-foreground">
              باکس‌های پروژه {boxes !== undefined ? `(${toFa(boxes.length)})` : ''}
            </h2>
            <Button
              variant="outline"
              size="sm"
              className="min-h-11"
              onClick={() => {
                setEditingBox(null)
                setBoxDialogOpen(true)
              }}
            >
              <Plus className="size-4" />
              باکس جدید
            </Button>
          </div>
          {boxes === undefined ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-16 rounded-xl" />
              ))}
            </div>
          ) : boxes.length === 0 ? (
            <EmptyState
              title="باکسی ثبت نشده است"
              hint="باکس‌های تقسیم و فیبر را زیر مسیرهای پروژه ثبت کنید."
              actionLabel="باکس جدید"
              onAction={() => {
                setEditingBox(null)
                setBoxDialogOpen(true)
              }}
            />
          ) : (
            <div className="space-y-3">
              {boxes.map((b) => (
                <ItemCard
                  key={b.id}
                  title={`باکس ${toFa(b.number)}`}
                  badges={<StatusBadge label={boxStatusLabels[b.status]} variant={boxStatusVariants[b.status]} />}
                  subtitle={[b.location, b.cableSpec].filter(Boolean).join(' • ')}
                  onClick={() => navigate('box', { projectId, routeId: b.routeId, boxId: b.id })}
                  trailing={
                    <RowMenu
                      label={`باکس ${b.number}`}
                      archived={b.archived}
                      onEdit={() => {
                        setEditingBox(b)
                        setBoxDialogOpen(true)
                      }}
                      onArchive={async () => {
                        try {
                          await setBoxArchived(b.id, b.archived === 1 ? 0 : 1)
                          toast.success(b.archived === 1 ? messages.unarchived : messages.archived)
                        } catch {
                          toast.error(messages.error)
                        }
                      }}
                      onDelete={() => setBoxDeleteTarget(b)}
                    />
                  }
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ---------- عملیات ---------- */}
      {tab === 'operations' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-muted-foreground">
              عملیات پروژه {operations !== undefined ? `(${toFa(operations.length)})` : ''}
            </h2>
            <Button variant="outline" size="sm" className="min-h-11" onClick={() => navigate('operations', { projectId })}>
              <Plus className="size-4" />
              ثبت عملیات
            </Button>
          </div>
          {operations === undefined ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-16 rounded-xl" />
              ))}
            </div>
          ) : operations.length === 0 ? (
            <EmptyState
              title="عملیاتی ثبت نشده است"
              hint="بازدید، نصب باکس، فیوژن، تست توان و سایر کارهای اجرایی را در بخش عملیات ثبت کنید."
              actionLabel="ثبت عملیات"
              onAction={() => navigate('operations', { projectId })}
            />
          ) : (
            <div className="space-y-3">
              {operations.map((op) => (
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
                  onClick={() => navigate('operations', { projectId, operationId: op.id })}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ---------- عکس‌ها ---------- */}
      {tab === 'photos' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-muted-foreground">عکس‌های پروژه</h2>
            <PhotoPickerButton link={{ projectId }} category="project" baseTitle={project.name} label="افزودن عکس" />
          </div>
          <PhotoGallery filter={{ projectId }} emptyHint="برای این پروژه عکسی ثبت نشده است." />
        </div>
      )}

      {/* ---------- دیالوگ‌ها ---------- */}
      <ProjectEditDialog open={projectDialogOpen} onOpenChange={setProjectDialogOpen} editing={editingProject} />
      <RouteFormDialog
        open={routeDialogOpen}
        onOpenChange={setRouteDialogOpen}
        projectId={projectId}
        editing={editingRoute}
      />
      <BoxFormDialog
        open={boxDialogOpen}
        onOpenChange={setBoxDialogOpen}
        projectId={projectId}
        routes={allRoutes ?? []}
        editing={editingBox}
      />

      {/* تأیید حذف پروژه */}
      <ConfirmDialog
        open={projectDeleteOpen}
        onOpenChange={setProjectDeleteOpen}
        title="تأیید حذف پروژه"
        description={`«${project.name}» ${messages.deleteConfirmDesc}`}
        confirmLabel="حذف"
        destructive
        loading={deleting}
        onConfirm={handleProjectDelete}
      />

      {/* تأیید حذف مسیر */}
      <ConfirmDialog
        open={!!routeDeleteTarget}
        onOpenChange={(o) => {
          if (!o) setRouteDeleteTarget(null)
        }}
        title="تأیید حذف مسیر"
        description={`${routeDeleteTarget ? `«${routeDeleteTarget.name}» ` : ''}${messages.deleteConfirmDesc}`}
        confirmLabel="حذف"
        destructive
        loading={routeDeleting}
        onConfirm={handleRouteDelete}
      />

      {/* تأیید حذف باکس */}
      <ConfirmDialog
        open={!!boxDeleteTarget}
        onOpenChange={(o) => {
          if (!o) setBoxDeleteTarget(null)
        }}
        title="تأیید حذف باکس"
        description={`${boxDeleteTarget ? `«باکس ${boxDeleteTarget.number}» ` : ''}${messages.deleteConfirmDesc}`}
        confirmLabel="حذف"
        destructive
        loading={boxDeleting}
        onConfirm={handleBoxDelete}
      />
    </div>
  )
}
