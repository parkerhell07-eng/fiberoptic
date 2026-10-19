'use client'

// فایبرکار — جزئیات مسیر (اطلاعات، باکس‌های مسیر، عکس‌ها)
import * as React from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  Archive,
  ArchiveRestore,
  Box as BoxIcon,
  Loader2,
  MoreVertical,
  Pencil,
  Plus,
  Trash2,
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
  PageHeader,
  StatusBadge,
} from '@/components/fiberkar/primitives'
import { PhotoPickerButton } from '@/components/fiberkar/photo-picker'
import { PhotoGallery } from '@/components/fiberkar/photo-gallery'
import { useAppStore } from '@/store/app-store'
import {
  createBox,
  db,
  deleteBoxCascade,
  deleteRouteCascade,
  setBoxArchived,
  setRouteArchived,
  updateBox,
  updateRoute,
  type BoxInput,
  type RouteInput,
} from '@/lib/localdb'
import { boxStatusLabels, boxStatusVariants, messages } from '@/lib/labels'
import { formatJalaliDateTime, toFa } from '@/lib/persian'
import type { Box, BoxStatus, Project, Route } from '@/lib/types'

function CenterSpinner() {
  return (
    <div className="flex justify-center py-16">
      <Loader2 className="size-6 animate-spin text-muted-foreground" aria-label="در حال بارگذاری" />
    </div>
  )
}

// ---------- فرم باکس (محلی) ----------
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
          <Button onClick={handleSave} disabled={saving} className="min-h-11 flex-1">
            {saving ? 'در حال ذخیره…' : 'ذخیره'}
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving} className="min-h-11 flex-1">
            انصراف
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ---------- منوی ردیف باکس ----------
function BoxRowMenu({
  box,
  onEdit,
  onArchive,
  onDelete,
}: {
  box: Box
  onEdit: () => void
  onArchive: () => void
  onDelete: () => void
}) {
  return (
    <DropdownMenu dir="rtl">
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="size-11"
          aria-label={`گزینه‌های باکس ${box.number}`}
          onClick={(e) => e.stopPropagation()}
        >
          <MoreVertical className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" onClick={(e) => e.stopPropagation()}>
        <DropdownMenuItem onClick={onEdit}>
          <Pencil className="size-4" />
          ویرایش
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onArchive}>
          {box.archived === 1 ? <ArchiveRestore className="size-4" /> : <Archive className="size-4" />}
          {box.archived === 1 ? 'خروج از آرشیو' : 'آرشیو'}
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
export default function RouteDetailView() {
  const params = useAppStore((s) => s.params)
  const navigate = useAppStore((s) => s.navigate)
  const back = useAppStore((s) => s.back)
  const routeId = params.routeId

  const route = useLiveQuery<Route | null>(async () => (routeId ? (await db.routes.get(routeId)) ?? null : null), [routeId])
  const projectId = params.projectId ?? route?.projectId

  const project = useLiveQuery<Project | undefined>(async () => (projectId ? db.projects.get(projectId) : undefined), [projectId])

  const boxes = useLiveQuery(async () => {
    if (!routeId) return []
    const bs = await db.boxes.where('routeId').equals(routeId).filter((b) => !b.archived).toArray()
    return bs.sort((a, b) => b.createdAt - a.createdAt)
  }, [routeId])

  const projectRoutes = useLiveQuery(async () => {
    if (!projectId) return []
    const rs = await db.routes.where('projectId').equals(projectId).toArray()
    return rs.sort((a, b) => a.createdAt - b.createdAt)
  }, [projectId])

  // وضعیت‌های محلی
  const [editOpen, setEditOpen] = React.useState(false)
  const [editForm, setEditForm] = React.useState<{ name: string; code: string; description: string }>({ name: '', code: '', description: '' })
  const [editError, setEditError] = React.useState<string | null>(null)
  const [editSaving, setEditSaving] = React.useState(false)
  const [boxDialogOpen, setBoxDialogOpen] = React.useState(false)
  const [editingBox, setEditingBox] = React.useState<Box | null>(null)
  const [boxDeleteTarget, setBoxDeleteTarget] = React.useState<Box | null>(null)
  const [routeDeleteOpen, setRouteDeleteOpen] = React.useState(false)
  const [routeDeleting, setRouteDeleting] = React.useState(false)
  const [boxDeleting, setBoxDeleting] = React.useState(false)

  // ---------- گاردها ----------
  if (!routeId) {
    return (
      <EmptyState
        title="مسیری انتخاب نشده است"
        hint="از جزئیات پروژه یک مسیر را انتخاب کنید."
        actionLabel="فهرست پروژه‌ها"
        onAction={() => navigate('projects')}
      />
    )
  }
  if (route === undefined) return <CenterSpinner />
  if (route === null) {
    return (
      <EmptyState
        title="مسیر یافت نشد"
        hint="ممکن است این مسیر حذف شده باشد."
        actionLabel="فهرست پروژه‌ها"
        onAction={() => navigate('projects')}
      />
    )
  }

  const handleEditSave = async () => {
    if (!editForm.name.trim()) {
      setEditError('نام مسیر الزامی است')
      return
    }
    setEditSaving(true)
    try {
      const input: RouteInput = {
        projectId: route.projectId,
        name: editForm.name.trim(),
        code: editForm.code.trim(),
        description: editForm.description.trim(),
      }
      await updateRoute(route.id, input)
      toast.success(messages.updated)
      setEditOpen(false)
    } catch {
      toast.error(messages.error)
    } finally {
      setEditSaving(false)
    }
  }

  const handleRouteDelete = async () => {
    setRouteDeleting(true)
    try {
      await deleteRouteCascade(route.id)
      toast.success(messages.deleted)
      setRouteDeleteOpen(false)
      if (projectId) navigate('project', { projectId })
      else navigate('projects')
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

  const subtitle = [route.code ? `کد: ${toFa(route.code)}` : null, project?.name].filter(Boolean).join(' • ')

  return (
    <div className="space-y-4">
      <PageHeader
        title={route.name}
        subtitle={subtitle}
        onBack={back}
        actions={
          <>
            <Button
              variant="outline"
              size="icon"
              className="size-11"
              aria-label="ویرایش مسیر"
              onClick={() => {
                setEditForm({ name: route.name, code: route.code, description: route.description })
                setEditError(null)
                setEditOpen(true)
              }}
            >
              <Pencil className="size-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="size-11"
              aria-label={route.archived === 1 ? 'خروج از آرشیو' : 'آرشیو مسیر'}
              onClick={async () => {
                try {
                  if (route.archived === 1) {
                    await setRouteArchived(route.id, 0)
                    toast.success(messages.unarchived)
                  } else {
                    await setRouteArchived(route.id, 1)
                    toast.success(messages.archived)
                  }
                } catch {
                  toast.error(messages.error)
                }
              }}
            >
              {route.archived === 1 ? <ArchiveRestore className="size-4" /> : <Archive className="size-4" />}
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="size-11 text-destructive"
              aria-label="حذف مسیر"
              onClick={() => setRouteDeleteOpen(true)}
            >
              <Trash2 className="size-4" />
            </Button>
          </>
        }
      />

      {/* کارت اطلاعات */}
      <div className="rounded-xl border p-4">
        <InfoRow label="پروژه" value={project?.name ?? '—'} />
        <InfoRow label="کد مسیر" value={route.code ? toFa(route.code) : '—'} />
        <InfoRow label="توضیحات" value={route.description || '—'} />
        <InfoRow label="تاریخ ثبت" value={formatJalaliDateTime(route.createdAt)} />
      </div>

      {/* باکس‌های مسیر */}
      <section aria-label="باکس‌های مسیر" className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-muted-foreground">
            باکس‌های این مسیر {boxes !== undefined ? `(${toFa(boxes.length)})` : ''}
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
            icon={<BoxIcon className="size-10" />}
            title="باکسی در این مسیر ثبت نشده است"
            hint="باکس‌های تقسیم و فیبر این مسیر را ثبت کنید."
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
                onClick={() => navigate('box', { projectId: b.projectId, routeId: b.routeId, boxId: b.id })}
                trailing={
                  <BoxRowMenu
                    box={b}
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
      </section>

      {/* عکس‌ها */}
      <section aria-label="عکس‌های مسیر" className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-muted-foreground">عکس‌های مسیر</h2>
          <PhotoPickerButton
            link={{ projectId: route.projectId, routeId: route.id }}
            category="other"
            baseTitle={route.name}
            label="افزودن عکس"
          />
        </div>
        <PhotoGallery filter={{ routeId: route.id }} emptyHint="برای این مسیر عکسی ثبت نشده است." />
      </section>

      {/* ---------- دیالوگ‌ها ---------- */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent dir="rtl" className="max-w-lg">
          <DialogHeader>
            <DialogTitle>ویرایش مسیر</DialogTitle>
            <DialogDescription>نام، کد و توضیحات مسیر را ویرایش کنید.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <Field label="نام مسیر" required error={editError}>
              <Input
                value={editForm.name}
                onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                className="min-h-11"
              />
            </Field>
            <Field label="کد مسیر" hint="اختیاری">
              <Input
                value={editForm.code}
                onChange={(e) => setEditForm((f) => ({ ...f, code: e.target.value }))}
                className="min-h-11"
                dir="ltr"
              />
            </Field>
            <Field label="توضیحات">
              <Textarea
                value={editForm.description}
                onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
                className="min-h-20"
              />
            </Field>
          </div>
          <DialogFooter className="flex-row justify-start gap-2">
            <Button onClick={handleEditSave} disabled={editSaving} className="min-h-11 flex-1">
              {editSaving ? 'در حال ذخیره…' : 'ذخیره'}
            </Button>
            <Button variant="outline" onClick={() => setEditOpen(false)} disabled={editSaving} className="min-h-11 flex-1">
              انصراف
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <BoxFormDialog
        open={boxDialogOpen}
        onOpenChange={setBoxDialogOpen}
        projectId={route.projectId}
        routes={projectRoutes ?? []}
        defaultRouteId={route.id}
        editing={editingBox}
      />

      {/* تأیید حذف مسیر */}
      <ConfirmDialog
        open={routeDeleteOpen}
        onOpenChange={setRouteDeleteOpen}
        title="تأیید حذف مسیر"
        description={`«${route.name}» ${messages.deleteConfirmDesc}`}
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
