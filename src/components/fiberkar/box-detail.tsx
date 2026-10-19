'use client'

// فایبرکار — جزئیات باکس (فیوژن‌ها، تست‌های توان، عملیات، دراپ‌کابل‌ها، عکس‌ها)
import * as React from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  Archive,
  ArchiveRestore,
  Cable,
  ChevronLeft,
  ClipboardList,
  Gauge,
  Loader2,
  Pencil,
  Sparkles,
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
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import {
  ConfirmDialog,
  EmptyState,
  Field,
  InfoRow,
  PageHeader,
  SegmentedTabs,
  StatusBadge,
} from '@/components/fiberkar/primitives'
import { PhotoPickerButton } from '@/components/fiberkar/photo-picker'
import { PhotoGallery } from '@/components/fiberkar/photo-gallery'
import { useAppStore } from '@/store/app-store'
import {
  createBox,
  db,
  deleteBoxCascade,
  setBoxArchived,
  updateBox,
  type BoxInput,
} from '@/lib/localdb'
import {
  boxStatusLabels,
  boxStatusVariants,
  installStatusLabels,
  installStatusVariants,
  messages,
  operationStatusLabels,
  operationStatusVariants,
  operationTypeLabels,
} from '@/lib/labels'
import { formatJalali, formatJalaliDateTime, formatNum, toFa } from '@/lib/persian'
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
  editing,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectId: string
  routes: Route[]
  /** اسنپ‌شات باکس در زمان بازشدن — هرگز آبجکت زنده liveQuery نیست */
  editing: Box | null
}) {
  const [form, setForm] = React.useState<BoxFormValues>({
    number: '',
    location: '',
    cableSpec: '',
    capacity: '',
    status: 'not_installed',
    routeId: '',
    description: '',
  })
  const [errors, setErrors] = React.useState<{ number?: string; routeId?: string }>({})
  const [saving, setSaving] = React.useState(false)

  React.useEffect(() => {
    if (!open || !editing) return
    setForm({
      number: editing.number,
      location: editing.location,
      cableSpec: editing.cableSpec,
      capacity: editing.capacity,
      status: editing.status,
      routeId: editing.routeId,
      description: editing.description,
    })
    setErrors({})
  }, [open, editing])

  async function handleSave() {
    if (!editing) return
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
      await updateBox(editing.id, input)
      toast.success(messages.updated)
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
          id="box-edit-form"
          onSubmit={(e) => {
            e.preventDefault()
            handleSave()
          }}
          className="flex flex-col gap-4"
        >
        <DialogHeader>
          <DialogTitle>ویرایش باکس</DialogTitle>
          <DialogDescription>مشخصات باکس را ویرایش کنید؛ شماره باکس و مسیر الزامی هستند.</DialogDescription>
        </DialogHeader>
        <div className="grid max-h-[60vh] gap-4 overflow-y-auto pe-1">
          <Field label="شماره باکس" required error={errors.number}>
            <Input
              value={form.number}
              onChange={(e) => setForm((f) => ({ ...f, number: e.target.value }))}
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
              className="min-h-11"
            />
          </Field>
          <Field label="مشخصات کابل" hint="اختیاری">
            <Input
              value={form.cableSpec}
              onChange={(e) => setForm((f) => ({ ...f, cableSpec: e.target.value }))}
              className="min-h-11"
            />
          </Field>
          <Field label="ظرفیت" hint="اختیاری — مثلاً 1x8">
            <Input
              value={form.capacity}
              onChange={(e) => setForm((f) => ({ ...f, capacity: e.target.value }))}
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
          <Button type="submit" form="box-edit-form" disabled={saving} className="min-h-11 flex-1">
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

// ---------- دکمه پیمایش بخش ----------
function SectionNavButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Button variant="outline" className="min-h-11 w-full sm:w-auto" onClick={onClick}>
      {label}
      <ChevronLeft className="size-4" />
    </Button>
  )
}

// ---------- نمای اصلی ----------
type BoxTab = 'fusions' | 'power' | 'operations' | 'drops' | 'photos'

export default function BoxDetailView() {
  const params = useAppStore((s) => s.params)
  const navigate = useAppStore((s) => s.navigate)
  const replace = useAppStore((s) => s.replace)
  const back = useAppStore((s) => s.back)
  const boxId = params.boxId

  const box = useLiveQuery<Box | null>(async () => (boxId ? (await db.boxes.get(boxId)) ?? null : null), [boxId])
  const projectId = params.projectId ?? box?.projectId
  const routeId = params.routeId ?? box?.routeId

  const project = useLiveQuery<Project | undefined>(async () => (projectId ? db.projects.get(projectId) : undefined), [projectId])
  const route = useLiveQuery<Route | undefined>(async () => (routeId ? db.routes.get(routeId) : undefined), [routeId])

  const projectRoutes = useLiveQuery(async () => {
    if (!projectId) return []
    const rs = await db.routes.where('projectId').equals(projectId).toArray()
    return rs.sort((a, b) => a.createdAt - b.createdAt)
  }, [projectId])

  const fusions = useLiveQuery(async () => {
    if (!boxId) return []
    const fs = await db.fusions.where('boxId').equals(boxId).toArray()
    return fs.sort((a, b) => b.createdAt - a.createdAt)
  }, [boxId])

  const powerTests = useLiveQuery(async () => {
    if (!boxId) return []
    const ts = await db.powerTests.where('boxId').equals(boxId).toArray()
    return ts.sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt)
  }, [boxId])

  const operations = useLiveQuery(async () => {
    if (!boxId) return []
    const ops = await db.operations.where('boxId').equals(boxId).toArray()
    return ops.sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt)
  }, [boxId])

  const dropCables = useLiveQuery(async () => {
    if (!boxId) return []
    const ds = await db.dropCables.where('sourceBoxId').equals(boxId).toArray()
    return ds.sort((a, b) => b.createdAt - a.createdAt)
  }, [boxId])

  // وضعیت‌های محلی
  const [tab, setTab] = React.useState<BoxTab>('fusions')
  const [editOpen, setEditOpen] = React.useState(false)
  // اسنپ‌شات باکس در زمان بازشدن فرم ویرایش (رکورد زنده liveQuery به فرم داده نمی‌شود)
  const [editingBox, setEditingBox] = React.useState<Box | null>(null)
  const [deleteOpen, setDeleteOpen] = React.useState(false)
  const [deleting, setDeleting] = React.useState(false)

  // ---------- گاردها ----------
  if (!boxId) {
    return (
      <EmptyState
        title="باکسی انتخاب نشده است"
        hint="از جزئیات مسیر یا پروژه یک باکس را انتخاب کنید."
        actionLabel="فهرست پروژه‌ها"
        onAction={() => navigate('projects')}
      />
    )
  }
  if (box === undefined) return <CenterSpinner />
  if (box === null) {
    return (
      <EmptyState
        title="باکس یافت نشد"
        hint="ممکن است این باکس حذف شده باشد."
        actionLabel="فهرست پروژه‌ها"
        onAction={() => navigate('projects')}
      />
    )
  }

  const pid = box.projectId
  const rid = box.routeId

  const handleDelete = async () => {
    setDeleting(true)
    try {
      await deleteBoxCascade(box.id)
      toast.success(messages.deleted)
      setDeleteOpen(false)
      // replace: Back نباید به باکس حذف‌شده برگردد
      replace('route', { routeId: rid, projectId: pid })
    } catch {
      toast.error(messages.error)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title={`باکس ${toFa(box.number)}`}
        subtitle={[box.location, project?.name].filter(Boolean).join(' • ')}
        onBack={back}
        actions={
          <>
            <Button variant="outline" size="icon" className="size-11" aria-label="ویرایش باکس" onClick={() => {
              setEditingBox(box)
              setEditOpen(true)
            }}>
              <Pencil className="size-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="size-11"
              aria-label={box.archived === 1 ? 'خروج از آرشیو' : 'آرشیو باکس'}
              onClick={async () => {
                try {
                  if (box.archived === 1) {
                    await setBoxArchived(box.id, 0)
                    toast.success(messages.unarchived)
                  } else {
                    await setBoxArchived(box.id, 1)
                    toast.success(messages.archived)
                  }
                } catch {
                  toast.error(messages.error)
                }
              }}
            >
              {box.archived === 1 ? <ArchiveRestore className="size-4" /> : <Archive className="size-4" />}
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="size-11 text-destructive"
              aria-label="حذف باکس"
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2 className="size-4" />
            </Button>
          </>
        }
      />

      {/* کارت اطلاعات */}
      <div className="rounded-xl border p-4">
        <InfoRow
          label="وضعیت"
          value={
            <>
              <StatusBadge label={boxStatusLabels[box.status]} variant={boxStatusVariants[box.status]} />
              {box.archived === 1 ? <StatusBadge label="آرشیو" variant="outline" /> : null}
            </>
          }
        />
        <InfoRow label="محل نصب" value={box.location || '—'} />
        <InfoRow label="ظرفیت" value={box.capacity ? toFa(box.capacity) : '—'} />
        <InfoRow label="مشخصات کابل" value={box.cableSpec || '—'} />
        <InfoRow label="مسیر" value={route?.name ?? '—'} />
        <InfoRow label="پروژه" value={project?.name ?? '—'} />
        {box.description ? <InfoRow label="توضیحات" value={box.description} /> : null}
        <InfoRow label="تاریخ ثبت" value={formatJalaliDateTime(box.createdAt)} />
      </div>

      <SegmentedTabs
        value={tab}
        onChange={(v) => setTab(v as BoxTab)}
        options={[
          { value: 'fusions', label: 'فیوژن‌ها' },
          { value: 'power', label: 'تست توان' },
          { value: 'operations', label: 'عملیات' },
          { value: 'drops', label: 'دراپ‌کابل' },
          { value: 'photos', label: 'عکس‌ها' },
        ]}
      />

      {/* ---------- فیوژن‌ها ---------- */}
      {tab === 'fusions' && (
        <section className="space-y-3" aria-label="فیوژن‌های این باکس">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-muted-foreground">
              فیوژن‌های این باکس {fusions !== undefined ? `(${toFa(fusions.length)})` : ''}
            </h2>
            <Sparkles className="size-4 text-primary" />
          </div>
          {fusions === undefined ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-16 rounded-xl" />
              ))}
            </div>
          ) : fusions.length === 0 ? (
            <p className="rounded-xl border border-dashed p-4 text-center text-sm text-muted-foreground">فیوژنی برای این باکس ثبت نشده است</p>
          ) : (
            <div className="space-y-3">
              {fusions.map((fs) => (
                <div key={fs.id} className="rounded-xl border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-semibold">تارها: {fs.fiberNumbers ? toFa(fs.fiberNumbers) : '—'}</span>
                    <span className="text-xs text-muted-foreground">{formatJalali(fs.fusionDate)}</span>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    اتصال: {fs.connectionId ? toFa(fs.connectionId) : '—'}
                    {fs.tubeNumber ? ` • تیوب: ${toFa(fs.tubeNumber)}` : ''}
                  </div>
                  {fs.result ? <div className="mt-1 text-xs">نتیجه: {fs.result}</div> : null}
                </div>
              ))}
            </div>
          )}
          <SectionNavButton
            label="ثبت/مشاهده فیوژن این باکس"
            onClick={() => navigate('fusion', { projectId: pid, routeId: rid, boxId })}
          />
        </section>
      )}

      {/* ---------- تست‌های توان ---------- */}
      {tab === 'power' && (
        <section className="space-y-3" aria-label="تست‌های توان این باکس">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-muted-foreground">
              تست‌های توان این باکس {powerTests !== undefined ? `(${toFa(powerTests.length)})` : ''}
            </h2>
            <Gauge className="size-4 text-primary" />
          </div>
          {powerTests === undefined ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-16 rounded-xl" />
              ))}
            </div>
          ) : powerTests.length === 0 ? (
            <p className="rounded-xl border border-dashed p-4 text-center text-sm text-muted-foreground">تست توانی برای این باکس ثبت نشده است</p>
          ) : (
            <div className="space-y-3">
              {powerTests.map((pt) => (
                <div key={pt.id} className="rounded-xl border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-semibold">
                      توان: {formatNum(pt.value, 2)} {pt.unit}
                      {pt.wavelengthNm ? ` • ${toFa(pt.wavelengthNm)} نانومتر` : ''}
                    </span>
                    <span className="text-xs text-muted-foreground">{formatJalali(pt.date)}</span>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    محل: {pt.location || '—'}
                    {pt.deviceModel ? ` • دستگاه: ${pt.deviceModel}` : ''}
                    {pt.assigneeName ? ` • مسئول: ${pt.assigneeName}` : ''}
                  </div>
                </div>
              ))}
            </div>
          )}
          <SectionNavButton
            label="ثبت/مشاهده تست توان این باکس"
            onClick={() => navigate('power-tests', { projectId: pid, routeId: rid, boxId })}
          />
        </section>
      )}

      {/* ---------- عملیات ---------- */}
      {tab === 'operations' && (
        <section className="space-y-3" aria-label="عملیات این باکس">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-muted-foreground">
              عملیات این باکس {operations !== undefined ? `(${toFa(operations.length)})` : ''}
            </h2>
            <ClipboardList className="size-4 text-primary" />
          </div>
          {operations === undefined ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-16 rounded-xl" />
              ))}
            </div>
          ) : operations.length === 0 ? (
            <p className="rounded-xl border border-dashed p-4 text-center text-sm text-muted-foreground">عملیاتی برای این باکس ثبت نشده است</p>
          ) : (
            <div className="space-y-3">
              {operations.map((op) => (
                <div key={op.id} className="rounded-xl border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="flex items-center gap-2 text-sm font-semibold">
                      {op.title || operationTypeLabels[op.type]}
                      <StatusBadge label={operationStatusLabels[op.status]} variant={operationStatusVariants[op.status]} />
                    </span>
                    <span className="text-xs text-muted-foreground">{formatJalali(op.date)}</span>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    <span>{op.customTypeLabel || operationTypeLabels[op.type]}</span>
                    {op.assigneeName ? ` • مسئول: ${op.assigneeName}` : ''}
                  </div>
                </div>
              ))}
            </div>
          )}
          <SectionNavButton
            label="ثبت عملیات برای این باکس"
            onClick={() => navigate('operations', { projectId: pid, routeId: rid, boxId })}
          />
        </section>
      )}

      {/* ---------- دراپ‌کابل‌ها ---------- */}
      {tab === 'drops' && (
        <section className="space-y-3" aria-label="دراپ‌کابل‌های این باکس">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-muted-foreground">
              دراپ‌کابل‌های این باکس {dropCables !== undefined ? `(${toFa(dropCables.length)})` : ''}
            </h2>
            <Cable className="size-4 text-primary" />
          </div>
          {dropCables === undefined ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-16 rounded-xl" />
              ))}
            </div>
          ) : dropCables.length === 0 ? (
            <p className="rounded-xl border border-dashed p-4 text-center text-sm text-muted-foreground">دراپ‌کابلی از این باکس ثبت نشده است</p>
          ) : (
            <div className="space-y-3">
              {dropCables.map((dc) => (
                <div key={dc.id} className="rounded-xl border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-semibold">مقصد: {dc.destination || '—'}</span>
                    <span className="text-xs text-muted-foreground">{formatJalali(dc.date)}</span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    {dc.serviceId ? <span>شناسه سرویس: {toFa(dc.serviceId)}</span> : null}
                    <StatusBadge label={installStatusLabels[dc.installStatus]} variant={installStatusVariants[dc.installStatus]} />
                  </div>
                </div>
              ))}
            </div>
          )}
          <SectionNavButton
            label="ثبت دراپ‌کابل از این باکس"
            onClick={() => navigate('drop-cables', { projectId: pid, routeId: rid, boxId })}
          />
        </section>
      )}

      {/* ---------- عکس‌ها ---------- */}
      {tab === 'photos' && (
        <section className="space-y-3" aria-label="عکس‌های این باکس">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-muted-foreground">عکس‌های این باکس</h2>
            <PhotoPickerButton
              link={{ projectId: pid, routeId: rid, boxId }}
              category="box_install"
              baseTitle={`باکس ${box.number}`}
              label="افزودن عکس"
            />
          </div>
          <PhotoGallery filter={{ boxId }} emptyHint="برای این باکس عکسی ثبت نشده است." />
        </section>
      )}

      {/* ---------- دیالوگ‌ها ---------- */}
      <BoxFormDialog open={editOpen} onOpenChange={setEditOpen} projectId={pid} routes={projectRoutes ?? []} editing={editingBox} />

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="تأیید حذف باکس"
        description={`«باکس ${box.number}» ${messages.deleteConfirmDesc}`}
        confirmLabel="حذف"
        destructive
        loading={deleting}
        onConfirm={handleDelete}
      />
    </div>
  )
}
