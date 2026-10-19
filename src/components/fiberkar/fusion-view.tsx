'use client'

// فایبرکار — فیوژن: ثبت/ویرایش/حذف رکوردهای فیوژن با سه عکس (قبل/حین/بعد از کار)
// مقدار «نتیجه» دقیقاً همان مقدار واقعی ثبت‌شده در محل ذخیره می‌شود؛ هیچ عددی ساختگی یا تبدیل‌شده ذخیره نمی‌شود.
import * as React from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { toast } from 'sonner'
import {
  Box as BoxIcon,
  Calendar,
  Gauge,
  Info,
  Link2,
  Loader2,
  MoreVertical,
  Pencil,
  Plus,
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import {
  createFusion,
  db,
  deleteFusionCascade,
  updateFusion,
  type FusionInput,
} from '@/lib/localdb'
import { messages } from '@/lib/labels'
import { formatJalali, toFa, todayISO } from '@/lib/persian'
import type { Box, Fusion } from '@/lib/types'
import { useAppStore } from '@/store/app-store'
import { PhotoGallery } from './photo-gallery'
import { PhotoPickerButton } from './photo-picker'
import { ConfirmDialog, EmptyState, Field, ItemCard, JalaliDatePicker, PageHeader } from './primitives'

const NONE = 'none'

// ---------- کمکی‌ها ----------
/** اطمینان از حضور گزینه انتخاب‌شده در فهرست (حتی اگر آرشیو شده باشد) */
function ensureSelected<T extends { id: string }>(list: T[], all: T[], selectedId: string | undefined): T[] {
  if (selectedId && !list.some((x) => x.id === selectedId)) {
    const current = all.find((x) => x.id === selectedId)
    if (current) return [...list, current]
  }
  return list
}

interface FusionForm {
  projectId: string | undefined
  routeId: string | undefined
  boxId: string | undefined
  connectionId: string
  fiberNumbers: string
  tubeNumber: string
  cableSpec: string
  deviceModel: string
  result: string
  fusionDate: string
  description: string
}

interface FusionErrors {
  projectId?: string
  fiberNumbers?: string
  fusionDate?: string
}

function emptyForm(projectId?: string, routeId?: string, boxId?: string): FusionForm {
  return {
    projectId,
    routeId,
    boxId,
    connectionId: '',
    fiberNumbers: '',
    tubeNumber: '',
    cableSpec: '',
    deviceModel: '',
    result: '',
    fusionDate: todayISO(),
    description: '',
  }
}

// ================= نمای فیوژن =================
export default function FusionView() {
  const params = useAppStore((s) => s.params)
  const back = useAppStore((s) => s.back)

  // ---------- فیلترها ----------
  const [filterProject, setFilterProject] = React.useState<string | undefined>(params.projectId)
  const [filterRoute, setFilterRoute] = React.useState<string | undefined>(params.routeId)
  const [filterBox, setFilterBox] = React.useState<string | undefined>(params.boxId)

  React.useEffect(() => {
    setFilterProject(params.projectId)
    setFilterRoute(params.routeId)
    setFilterBox(params.boxId)
  }, [params.projectId, params.routeId, params.boxId])

  // ---------- داده‌های واکنش‌گرا ----------
  const fusions = useLiveQuery(async () => {
    let col = db.fusions.orderBy('createdAt').reverse()
    if (filterProject) col = col.filter((f) => f.projectId === filterProject)
    if (filterRoute) col = col.filter((f) => f.routeId === filterRoute)
    if (filterBox) col = col.filter((f) => f.boxId === filterBox)
    return col.toArray()
  }, [filterProject, filterRoute, filterBox])

  const projects = useLiveQuery(() => db.projects.toArray(), [])
  const routes = useLiveQuery(() => db.routes.toArray(), [])
  const boxes = useLiveQuery(() => db.boxes.toArray(), [])

  const boxMap = React.useMemo(() => new Map((boxes ?? []).map((b) => [b.id, b])), [boxes])

  // ---------- گزینه‌های فیلتر ----------
  const filterProjectOptions = React.useMemo(() => {
    const all = projects ?? []
    return ensureSelected(
      all.filter((p) => !p.archived),
      all,
      filterProject
    )
  }, [projects, filterProject])

  const filterRouteOptions = React.useMemo(() => {
    const all = routes ?? []
    return ensureSelected(
      all.filter((r) => (filterProject ? r.projectId === filterProject : true)),
      all,
      filterRoute
    )
  }, [routes, filterProject, filterRoute])

  const filterBoxOptions = React.useMemo(() => {
    const all = boxes ?? []
    return ensureSelected(
      all.filter((b) => (filterRoute ? b.routeId === filterRoute : filterProject ? b.projectId === filterProject : true)),
      all,
      filterBox
    )
  }, [boxes, filterProject, filterRoute, filterBox])

  const chipProject = filterProject ? (projects ?? []).find((p) => p.id === filterProject) : undefined
  const chipRoute = filterRoute ? (routes ?? []).find((r) => r.id === filterRoute) : undefined
  const chipBox = filterBox ? boxMap.get(filterBox) : undefined

  // ---------- دیالوگ فرم ----------
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [editingId, setEditingId] = React.useState<string | null>(null)
  const [form, setForm] = React.useState<FusionForm>(() => emptyForm(params.projectId, params.routeId, params.boxId))
  const [errors, setErrors] = React.useState<FusionErrors>({})
  const [busy, setBusy] = React.useState(false)
  // بنر موفقیت در حالت ایجاد (دیالوگ باز می‌ماند تا عکس با شناسه واقعی پیوست شود)
  const [created, setCreated] = React.useState(false)

  // ---------- حذف ----------
  const [deleteTarget, setDeleteTarget] = React.useState<Fusion | null>(null)
  const [deleteBusy, setDeleteBusy] = React.useState(false)

  // ---------- گزینه‌های فرم (آبشاری) ----------
  const formProjectOptions = React.useMemo(() => {
    const all = projects ?? []
    return ensureSelected(
      all.filter((p) => !p.archived),
      all,
      form.projectId
    )
  }, [projects, form.projectId])

  const formRouteOptions = React.useMemo(() => {
    const all = routes ?? []
    return ensureSelected(
      all.filter((r) => (form.projectId ? r.projectId === form.projectId : false)),
      all,
      form.routeId
    )
  }, [routes, form.projectId, form.routeId])

  const formBoxOptions = React.useMemo(() => {
    const all = boxes ?? []
    return ensureSelected(
      all.filter((b) =>
        form.routeId ? b.routeId === form.routeId : form.projectId ? b.projectId === form.projectId : false
      ),
      all,
      form.boxId
    )
  }, [boxes, form.projectId, form.routeId, form.boxId])

  // ---------- کنترل فرم ----------
  // پیش‌فرض ایجاد: از فیلترهای فعال کاربر، با بازگشت به پارامترهای ناوبری
  function openCreate() {
    setForm(
      emptyForm(
        filterProject ?? params.projectId,
        filterRoute ?? params.routeId,
        filterBox ?? params.boxId
      )
    )
    setEditingId(null)
    setErrors({})
    setCreated(false)
    setDialogOpen(true)
  }

  function openEdit(f: Fusion) {
    setForm({
      projectId: f.projectId,
      routeId: f.routeId,
      boxId: f.boxId,
      connectionId: f.connectionId ?? '',
      fiberNumbers: f.fiberNumbers ?? '',
      tubeNumber: f.tubeNumber ?? '',
      cableSpec: f.cableSpec ?? '',
      deviceModel: f.deviceModel ?? '',
      result: f.result ?? '',
      fusionDate: f.fusionDate,
      description: f.description ?? '',
    })
    setEditingId(f.id)
    setErrors({})
    setCreated(false)
    setDialogOpen(true)
  }

  function handleDialogChange(open: boolean) {
    setDialogOpen(open)
    if (!open) {
      setErrors({})
      setCreated(false)
    }
  }

  function setFormProject(id: string | undefined) {
    setForm((f) => ({ ...f, projectId: id, routeId: undefined, boxId: undefined }))
  }

  function setFormRoute(id: string | undefined) {
    setForm((f) => ({ ...f, routeId: id, boxId: undefined }))
  }

  function validate(): FusionErrors {
    const errs: FusionErrors = {}
    if (!form.projectId) errs.projectId = 'انتخاب پروژه الزامی است'
    if (!form.fiberNumbers.trim()) errs.fiberNumbers = 'شماره تارها الزامی است'
    if (!form.fusionDate) errs.fusionDate = 'تاریخ فیوژن الزامی است'
    return errs
  }

  async function handleSave() {
    const errs = validate()
    if (Object.keys(errs).length > 0) {
      setErrors(errs)
      toast.error(messages.requiredMissing)
      return
    }
    if (!form.projectId) return
    setBusy(true)
    try {
      const input: FusionInput = {
        projectId: form.projectId,
        routeId: form.routeId,
        boxId: form.boxId,
        connectionId: form.connectionId.trim(),
        fiberNumbers: form.fiberNumbers.trim(),
        tubeNumber: form.tubeNumber.trim(),
        cableSpec: form.cableSpec.trim(),
        deviceModel: form.deviceModel.trim(),
        // نتیجه عیناً همان مقدار واردشده ذخیره می‌شود؛ هیچ تبدیل یا عدد ساختگی اضافه نمی‌شود
        result: form.result.trim(),
        fusionDate: form.fusionDate,
        description: form.description.trim(),
      }

      if (editingId) {
        await updateFusion(editingId, input)
        toast.success(messages.updated)
        setDialogOpen(false)
      } else {
        const rec = await createFusion(input)
        setEditingId(rec.id)
        setErrors({})
        setCreated(true)
        toast.success(messages.saved)
      }
    } catch {
      toast.error(messages.error)
    } finally {
      setBusy(false)
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    setDeleteBusy(true)
    try {
      await deleteFusionCascade(deleteTarget.id)
      toast.success(messages.deleted)
      setDeleteTarget(null)
    } catch {
      toast.error(messages.error)
    } finally {
      setDeleteBusy(false)
    }
  }

  // ---------- لینک عمیق: باز شدن خودکار ویرایش برای fusionId (فقط یک بار در هر نشانی) ----------
  const deepLinkConsumedRef = React.useRef(false)
  React.useEffect(() => {
    deepLinkConsumedRef.current = false
  }, [params.fusionId])
  React.useEffect(() => {
    if (deepLinkConsumedRef.current) return
    const id = params.fusionId
    if (!id || !fusions) return
    deepLinkConsumedRef.current = true
    const rec = fusions.find((x) => x.id === id)
    if (rec) openEdit(rec)
     
  }, [fusions, params.fusionId])

  // ================= رندر =================
  return (
    <>
      <PageHeader
        title="فیوژن"
        subtitle={fusions ? `${toFa(fusions.length)} مورد` : undefined}
        onBack={back}
        actions={
          <Button onClick={openCreate} className="min-h-11">
            <Plus className="size-4" />
            ثبت جدید
          </Button>
        }
      />

      {/* فیلترها */}
      <section aria-label="فیلترها" className="mb-4 flex flex-col gap-3 rounded-xl border bg-card p-4">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <Select
            value={filterProject ?? NONE}
            onValueChange={(v) => {
              const id = v === NONE ? undefined : v
              setFilterProject(id)
              setFilterRoute(undefined)
              setFilterBox(undefined)
            }}
          >
            <SelectTrigger className="min-h-11 w-full" aria-label="فیلتر پروژه">
              <SelectValue placeholder="همه پروژه‌ها" />
            </SelectTrigger>
            <SelectContent dir="rtl">
              <SelectItem value={NONE}>همه پروژه‌ها</SelectItem>
              {filterProjectOptions.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={filterRoute ?? NONE}
            onValueChange={(v) => {
              const id = v === NONE ? undefined : v
              setFilterRoute(id)
              setFilterBox(undefined)
            }}
          >
            <SelectTrigger className="min-h-11 w-full" aria-label="فیلتر مسیر">
              <SelectValue placeholder="همه مسیرها" />
            </SelectTrigger>
            <SelectContent dir="rtl">
              <SelectItem value={NONE}>همه مسیرها</SelectItem>
              {filterRouteOptions.map((r) => (
                <SelectItem key={r.id} value={r.id}>
                  {r.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filterBox ?? NONE} onValueChange={(v) => setFilterBox(v === NONE ? undefined : v)}>
            <SelectTrigger className="min-h-11 w-full" aria-label="فیلتر باکس">
              <SelectValue placeholder="همه باکس‌ها" />
            </SelectTrigger>
            <SelectContent dir="rtl">
              <SelectItem value={NONE}>همه باکس‌ها</SelectItem>
              {filterBoxOptions.map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  {`باکس ${b.number}${b.location ? ` — ${b.location}` : ''}`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {(chipProject || chipRoute || chipBox) && (
          <div className="flex flex-wrap items-center gap-2">
            {chipProject && (
              <FilterChip
                label={`پروژه: ${chipProject.name}`}
                onClear={() => {
                  setFilterProject(undefined)
                  setFilterRoute(undefined)
                  setFilterBox(undefined)
                }}
              />
            )}
            {chipRoute && (
              <FilterChip
                label={`مسیر: ${chipRoute.name}`}
                onClear={() => {
                  setFilterRoute(undefined)
                  setFilterBox(undefined)
                }}
              />
            )}
            {chipBox && <FilterChip label={`باکس: ${chipBox.number}`} onClear={() => setFilterBox(undefined)} />}
          </div>
        )}
      </section>

      {/* فهرست فیوژن‌ها */}
      {fusions === undefined ? (
        <div className="flex justify-center py-16">
          <Loader2 className="size-6 animate-spin text-muted-foreground" aria-label="در حال بارگذاری" />
        </div>
      ) : fusions.length === 0 ? (
        <EmptyState
          icon={<Link2 className="size-10" />}
          title="موردی ثبت نشده است"
          hint="رکوردهای فیوژن (اتصال تارها) را همراه با نتیجه واقعی دستگاه ثبت کنید."
          actionLabel="ثبت فیوژن جدید"
          onAction={openCreate}
        />
      ) : (
        <div className="flex flex-col gap-4">
          {fusions.map((f) => (
            <FusionCard key={f.id} fusion={f} boxMap={boxMap} onEdit={openEdit} onDelete={setDeleteTarget} />
          ))}
        </div>
      )}

      {/* دیالوگ ثبت/ویرایش */}
      <Dialog open={dialogOpen} onOpenChange={handleDialogChange}>
        <DialogContent dir="rtl" className="max-h-[85vh] max-w-lg overflow-y-auto">
          <form
            onSubmit={(e) => {
              e.preventDefault()
              handleSave()
            }}
            className="flex flex-col gap-4"
          >
          <DialogHeader>
            <DialogTitle>{editingId ? 'ویرایش فیوژن' : 'ثبت فیوژن جدید'}</DialogTitle>
            <DialogDescription>
              {editingId ? 'اطلاعات فیوژن را ویرایش و ذخیره کنید.' : 'اطلاعات اتصال فیوژن را تکمیل و ذخیره کنید.'}
            </DialogDescription>
          </DialogHeader>

          {created && (
            <div
              role="status"
              className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/10 px-3 py-2.5 text-sm font-medium text-primary"
            >
              ذخیره شد ✓ — اکنون می‌توانید برای این مورد عکس ثبت کنید یا مشخصات را تکمیل کنید
            </div>
          )}

          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="پروژه" required error={errors.projectId}>
                <Select value={form.projectId ?? NONE} onValueChange={(v) => setFormProject(v === NONE ? undefined : v)}>
                  <SelectTrigger className="min-h-11 w-full" aria-label="پروژه">
                    <SelectValue placeholder="انتخاب پروژه" />
                  </SelectTrigger>
                  <SelectContent dir="rtl">
                    {formProjectOptions.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Field label="مسیر (اختیاری)">
                <Select value={form.routeId ?? NONE} onValueChange={(v) => setFormRoute(v === NONE ? undefined : v)}>
                  <SelectTrigger className="min-h-11 w-full" aria-label="مسیر">
                    <SelectValue placeholder="انتخاب مسیر" />
                  </SelectTrigger>
                  <SelectContent dir="rtl">
                    <SelectItem value={NONE}>— بدون مسیر —</SelectItem>
                    {formRouteOptions.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>

            <Field label="باکس (اختیاری)">
              <Select
                value={form.boxId ?? NONE}
                onValueChange={(v) => setForm((f) => ({ ...f, boxId: v === NONE ? undefined : v }))}
              >
                <SelectTrigger className="min-h-11 w-full" aria-label="باکس">
                  <SelectValue placeholder="انتخاب باکس" />
                </SelectTrigger>
                <SelectContent dir="rtl">
                  <SelectItem value={NONE}>— بدون باکس —</SelectItem>
                  {formBoxOptions.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {`باکس ${b.number}${b.location ? ` — ${b.location}` : ''}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="شناسه اتصال">
                <Input
                  dir="ltr"
                  className="min-h-11 text-left"
                  value={form.connectionId}
                  onChange={(e) => setForm((f) => ({ ...f, connectionId: e.target.value }))}
                  placeholder="مثلاً SP-۱۲۰۴ یا 1204"
                />
              </Field>

              <Field label="مدل دستگاه فیوژن (اختیاری)">
                <Input
                  value={form.deviceModel}
                  onChange={(e) => setForm((f) => ({ ...f, deviceModel: e.target.value }))}
                  placeholder="مثلاً Sumitomo T-72C"
                  className="min-h-11"
                />
              </Field>
            </div>

            <Field label="شماره تارها" required error={errors.fiberNumbers} hint="شماره تارهای فیوژن‌شده، مثل 1,2,5-8">
              <Input
                dir="ltr"
                className="min-h-11 text-left"
                value={form.fiberNumbers}
                onChange={(e) => setForm((f) => ({ ...f, fiberNumbers: e.target.value }))}
                placeholder="مثلاً 1,2,5-8"
              />
            </Field>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="شماره تیوب (اختیاری)">
                <Input
                  value={form.tubeNumber}
                  onChange={(e) => setForm((f) => ({ ...f, tubeNumber: e.target.value }))}
                  placeholder="مثلاً ۲ یا 2"
                  className="min-h-11"
                />
              </Field>

              <Field label="مشخصات کابل (اختیاری)">
                <Input
                  value={form.cableSpec}
                  onChange={(e) => setForm((f) => ({ ...f, cableSpec: e.target.value }))}
                  placeholder="مثلاً 24 کور تک‌مود"
                  className="min-h-11"
                />
              </Field>
            </div>

            <Field
              label="نتیجه فیوژن (واقعی)"
              hint="همان مقداری که دستگاه نشان داده، عیناً ثبت می‌شود."
            >
              <Input
                dir="ltr"
                className="min-h-11 text-left"
                value={form.result}
                onChange={(e) => setForm((f) => ({ ...f, result: e.target.value }))}
                placeholder="مثلاً 0.02 dB — فقط مقدار واقعی دستگاه"
              />
            </Field>

            <div className="flex items-start gap-2 rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs leading-5 text-muted-foreground">
              <Info className="mt-0.5 size-4 shrink-0 text-primary" />
              <span>نتیجه صرفاً همان مقدار ثبت‌شده در محل است؛ مقدار ساختگی درج نمی‌شود.</span>
            </div>

            <Field label="تاریخ فیوژن" required error={errors.fusionDate}>
              <JalaliDatePicker
                value={form.fusionDate || undefined}
                onChange={(iso) => setForm((f) => ({ ...f, fusionDate: iso ?? '' }))}
                placeholder="انتخاب تاریخ"
              />
            </Field>

            <Field label="توضیحات">
              <Textarea
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                rows={3}
                placeholder="توضیحات تکمیلی…"
              />
            </Field>

            {editingId && (
              <>
                <Separator />
                <section aria-label="عکس‌های فیوژن" className="flex flex-col gap-3">
                  <span className="text-sm font-semibold">عکس‌های فیوژن</span>
                  <div className="flex flex-wrap gap-2">
                    <PhotoPickerButton
                      link={{
                        projectId: form.projectId,
                        routeId: form.routeId,
                        boxId: form.boxId,
                        fusionId: editingId,
                      }}
                      category="fusion"
                      baseTitle="قبل از فیوژن"
                      label="عکس قبل از کار"
                      size="sm"
                    />
                    <PhotoPickerButton
                      link={{
                        projectId: form.projectId,
                        routeId: form.routeId,
                        boxId: form.boxId,
                        fusionId: editingId,
                      }}
                      category="fusion"
                      baseTitle="حین فیوژن"
                      label="عکس حین کار"
                      size="sm"
                    />
                    <PhotoPickerButton
                      link={{
                        projectId: form.projectId,
                        routeId: form.routeId,
                        boxId: form.boxId,
                        fusionId: editingId,
                      }}
                      category="fusion"
                      baseTitle="بعد از فیوژن"
                      label="عکس بعد از کار"
                      size="sm"
                    />
                  </div>
                  <PhotoGallery filter={{ fusionId: editingId }} />
                </section>
              </>
            )}
          </div>

          <DialogFooter className="flex-row justify-start gap-2">
            <Button type="submit" disabled={busy} className="min-h-11 flex-1">
              {busy && <Loader2 className="size-4 animate-spin" />}
              {editingId ? 'ذخیره تغییرات' : 'ثبت و ذخیره'}
            </Button>
            <Button variant="outline" type="button" onClick={() => setDialogOpen(false)} disabled={busy} className="min-h-11 flex-1">
              بستن
            </Button>
          </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* تأیید حذف */}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(o) => {
          if (!o) setDeleteTarget(null)
        }}
        title={messages.deleteConfirmTitle}
        description={`${deleteTarget?.connectionId ? `حذف اتصال «${deleteTarget.connectionId}» — ` : 'حذف این فیوژن — '}${messages.deleteConfirmDesc}`}
        confirmLabel="حذف"
        destructive
        loading={deleteBusy}
        onConfirm={confirmDelete}
      />
    </>
  )
}

// ================= کارت فیوژن =================
function FusionCard({
  fusion: f,
  boxMap,
  onEdit,
  onDelete,
}: {
  fusion: Fusion
  boxMap: Map<string, Box>
  onEdit: (f: Fusion) => void
  onDelete: (f: Fusion) => void
}) {
  const box = f.boxId ? boxMap.get(f.boxId) : undefined

  // خوانش دفاعی — یک رکورد بازگردی‌شده ناقص هرگز نباید نمای را بشکند
  const tubeNumber = (f.tubeNumber ?? '').trim()
  const connectionId = (f.connectionId ?? '').trim()
  const result = (f.result ?? '').trim()

  const subtitleBits: string[] = []
  if (tubeNumber) subtitleBits.push(`تیوب: ${toFa(tubeNumber)}`)
  if (f.cableSpec?.trim()) subtitleBits.push(f.cableSpec)

  return (
    <ItemCard
      title={
        connectionId ? (
          <span className="flex items-center gap-1.5">
            اتصال
            <span dir="ltr">{connectionId}</span>
          </span>
        ) : (
          'فیوژن'
        )
      }
      subtitle={subtitleBits.length > 0 ? subtitleBits.join(' • ') : undefined}
      meta={
        <>
          <span className="flex items-center gap-1">
            <Link2 className="size-3.5 shrink-0" />
            {`تارها: ${toFa(f.fiberNumbers ?? '—')}`}
          </span>
          {result && (
            <span className="flex items-center gap-1">
              <Gauge className="size-3.5 shrink-0" />
              نتیجه:
              <span dir="ltr" className="font-medium text-foreground">
                {result}
              </span>
            </span>
          )}
          {box && (
            <span className="flex items-center gap-1">
              <BoxIcon className="size-3.5 shrink-0" />
              {`باکس ${box.number}`}
            </span>
          )}
          <span className="flex items-center gap-1">
            <Calendar className="size-3.5 shrink-0" />
            {formatJalali(f.fusionDate)}
          </span>
        </>
      }
      trailing={<RowMenu onEdit={() => onEdit(f)} onDelete={() => onDelete(f)} />}
    />
  )
}

// ================= منوی ردیف =================
function RowMenu({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  return (
    <DropdownMenu dir="rtl">
      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
        <Button variant="ghost" size="icon" className="size-11 shrink-0" aria-label="گزینه‌های بیشتر">
          <MoreVertical className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-32" onClick={(e) => e.stopPropagation()}>
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

// ================= چیپ فیلتر =================
function FilterChip({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <span className="flex items-center gap-1 rounded-full border bg-accent/60 py-1 pe-1.5 ps-3 text-xs font-medium">
      {label}
      <button
        type="button"
        onClick={onClear}
        aria-label={`برداشتن فیلتر ${label}`}
        className="flex size-6 items-center justify-center rounded-full transition-colors hover:bg-muted"
      >
        <X className="size-3.5" />
      </button>
    </span>
  )
}
