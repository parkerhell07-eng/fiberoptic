'use client'

// فایبرکار — تست توان: ثبت/ویرایش/حذف نتایج اندازه‌گیری توان
// مقدار اندازه‌گیری‌شده دقیقاً همان عدد واردشده ذخیره می‌شود؛ تبدیل dBm↔mW فقط برای نمایش است
// و همیشه با برچسب «محاسباتی» نشان داده می‌شود — هرگز ذخیره نمی‌شود.
import * as React from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { toast } from 'sonner'
import {
  Box as BoxIcon,
  Calculator,
  Calendar,
  Gauge,
  Loader2,
  MapPin,
  MoreVertical,
  Pencil,
  Plus,
  Trash2,
  UserRound,
  Waves,
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
  createPowerTest,
  db,
  deletePowerTestCascade,
  profileSnapshot,
  updatePowerTest,
  type PowerTestInput,
} from '@/lib/localdb'
import { messages, powerUnitLabels } from '@/lib/labels'
import { convertedPower, formatJalali, formatNum, toFa, todayISO } from '@/lib/persian'
import type { Box, PowerTest, PowerUnit } from '@/lib/types'
import { useAppStore } from '@/store/app-store'
import { PhotoGallery } from './photo-gallery'
import { PhotoPickerButton } from './photo-picker'
import {
  ConfirmDialog,
  EmptyState,
  Field,
  ItemCard,
  JalaliDatePicker,
  NumberField,
  PageHeader,
} from './primitives'

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

/** نمایش عدد توان با حفظ همان ارقام ثبت‌شده (فقط تبدیل رقم فارسی — نمایشی) */
function displayPowerValue(v: number): string {
  const s = String(v)
  if (s.includes('e') || s.includes('E')) return formatNum(v, 8)
  const decimals = s.includes('.') ? s.split('.')[1].length : 0
  return formatNum(v, decimals)
}

interface PowerTestForm {
  projectId: string | undefined
  routeId: string | undefined
  boxId: string | undefined
  location: string
  date: string
  value: number | undefined
  unit: PowerUnit
  wavelengthNm: number | undefined
  deviceModel: string
  assigneeProfileId: string | undefined
  assigneeName: string
  description: string
}

interface PowerTestErrors {
  projectId?: string
  location?: string
  date?: string
  value?: string
}

function emptyForm(projectId?: string, routeId?: string, boxId?: string): PowerTestForm {
  return {
    projectId,
    routeId,
    boxId,
    location: '',
    date: todayISO(),
    value: undefined,
    unit: 'dBm',
    wavelengthNm: undefined,
    deviceModel: '',
    assigneeProfileId: undefined,
    assigneeName: '',
    description: '',
  }
}

// ================= نمای تست توان =================
export default function PowerTestsView() {
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
  const powerTests = useLiveQuery(async () => {
    let col = db.powerTests.orderBy('createdAt').reverse()
    if (filterProject) col = col.filter((p) => p.projectId === filterProject)
    if (filterRoute) col = col.filter((p) => p.routeId === filterRoute)
    if (filterBox) col = col.filter((p) => p.boxId === filterBox)
    return col.toArray()
  }, [filterProject, filterRoute, filterBox])

  const projects = useLiveQuery(() => db.projects.toArray(), [])
  const routes = useLiveQuery(() => db.routes.toArray(), [])
  const boxes = useLiveQuery(() => db.boxes.toArray(), [])
  const profiles = useLiveQuery(() => db.profiles.toArray(), [])

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
  const [form, setForm] = React.useState<PowerTestForm>(() => emptyForm(params.projectId, params.routeId, params.boxId))
  const [errors, setErrors] = React.useState<PowerTestErrors>({})
  const [busy, setBusy] = React.useState(false)

  // ---------- حذف ----------
  const [deleteTarget, setDeleteTarget] = React.useState<PowerTest | null>(null)
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

  // تبدیل واحد توان — فقط برای نمایش؛ هرگز ذخیره نمی‌شود
  const conversion =
    form.value !== undefined && Number.isFinite(form.value) ? convertedPower(form.value, form.unit) : null

  // ---------- کنترل فرم ----------
  function openCreate() {
    setForm(emptyForm(params.projectId, params.routeId, params.boxId))
    setEditingId(null)
    setErrors({})
    setDialogOpen(true)
  }

  function openEdit(pt: PowerTest) {
    setForm({
      projectId: pt.projectId,
      routeId: pt.routeId,
      boxId: pt.boxId,
      location: pt.location,
      date: pt.date,
      value: pt.value,
      unit: pt.unit,
      wavelengthNm: pt.wavelengthNm,
      deviceModel: pt.deviceModel,
      assigneeProfileId: pt.assigneeProfileId,
      assigneeName: pt.assigneeName,
      description: pt.description,
    })
    setEditingId(pt.id)
    setErrors({})
    setDialogOpen(true)
  }

  function handleDialogChange(open: boolean) {
    setDialogOpen(open)
    if (!open) setErrors({})
  }

  function setFormProject(id: string | undefined) {
    setForm((f) => ({ ...f, projectId: id, routeId: undefined, boxId: undefined }))
  }

  function setFormRoute(id: string | undefined) {
    setForm((f) => ({ ...f, routeId: id, boxId: undefined }))
  }

  function setFormProfile(id: string | undefined) {
    setForm((f) => {
      if (!id) return { ...f, assigneeProfileId: undefined, assigneeName: '' }
      const p = (profiles ?? []).find((x) => x.id === id)
      if (!p) return { ...f, assigneeProfileId: id }
      const snap = profileSnapshot(p)
      return { ...f, assigneeProfileId: id, assigneeName: snap.name }
    })
  }

  function validate(): PowerTestErrors {
    const errs: PowerTestErrors = {}
    if (!form.projectId) errs.projectId = 'انتخاب پروژه الزامی است'
    if (!form.location.trim()) errs.location = 'محل تست الزامی است'
    if (!form.date) errs.date = 'تاریخ تست الزامی است'
    if (form.value === undefined || !Number.isFinite(form.value)) errs.value = 'مقدار توان الزامی است'
    else if (form.unit === 'mW' && form.value <= 0) errs.value = 'توان بر حسب mW باید بزرگ‌تر از صفر باشد'
    // مقدار منفی dBm مجاز است (مثلاً −۱۸٫۵)
    return errs
  }

  async function handleSave() {
    const errs = validate()
    if (Object.keys(errs).length > 0) {
      setErrors(errs)
      toast.error(messages.requiredMissing)
      return
    }
    if (!form.projectId || form.value === undefined) return
    setBusy(true)
    try {
      // اسنپ‌شات مسئول: اگر پروفایل موجود باشد از وضعیت فعلی؛ در غیر این صورت اسنپ‌شات قبلی حفظ می‌شود
      const prof = form.assigneeProfileId ? (profiles ?? []).find((p) => p.id === form.assigneeProfileId) : undefined
      let assigneeProfileId: string | undefined
      let assigneeName: string
      if (prof) {
        const snap = profileSnapshot(prof)
        assigneeProfileId = snap.profileId
        assigneeName = snap.name
      } else if (form.assigneeProfileId) {
        assigneeProfileId = form.assigneeProfileId
        assigneeName = form.assigneeName
      } else {
        assigneeName = ''
      }

      const input: PowerTestInput = {
        projectId: form.projectId,
        routeId: form.routeId,
        boxId: form.boxId,
        location: form.location.trim(),
        date: form.date,
        // مقدار واقعی اندازه‌گیری‌شده — بدون هیچ تغییری ذخیره می‌شود
        value: form.value,
        unit: form.unit,
        wavelengthNm: form.wavelengthNm,
        deviceModel: form.deviceModel.trim(),
        assigneeProfileId,
        assigneeName,
        description: form.description.trim(),
      }

      if (editingId) {
        await updatePowerTest(editingId, input)
        toast.success(messages.updated)
        setDialogOpen(false)
      } else {
        const created = await createPowerTest(input)
        setEditingId(created.id)
        setErrors({})
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
      await deletePowerTestCascade(deleteTarget.id)
      toast.success(messages.deleted)
      setDeleteTarget(null)
    } catch {
      toast.error(messages.error)
    } finally {
      setDeleteBusy(false)
    }
  }

  // ================= رندر =================
  return (
    <>
      <PageHeader
        title="تست توان"
        subtitle={powerTests ? `${toFa(powerTests.length)} مورد` : undefined}
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

      {/* فهرست تست‌های توان */}
      {powerTests === undefined ? (
        <div className="flex justify-center py-16">
          <Loader2 className="size-6 animate-spin text-muted-foreground" aria-label="در حال بارگذاری" />
        </div>
      ) : powerTests.length === 0 ? (
        <EmptyState
          icon={<Gauge className="size-10" />}
          title="موردی ثبت نشده است"
          hint="نتایج اندازه‌گیری توان (توان دریافتی مشترک یا خروجی تجهیزات) را دقیقاً همان‌طور که دستگاه نشان داده ثبت کنید."
          actionLabel="ثبت تست جدید"
          onAction={openCreate}
        />
      ) : (
        <div className="flex flex-col gap-4">
          {powerTests.map((pt) => (
            <PowerTestCard key={pt.id} test={pt} boxMap={boxMap} onEdit={openEdit} onDelete={setDeleteTarget} />
          ))}
        </div>
      )}

      {/* دیالوگ ثبت/ویرایش */}
      <Dialog open={dialogOpen} onOpenChange={handleDialogChange}>
        <DialogContent dir="rtl" className="max-h-[85vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? 'ویرایش تست توان' : 'ثبت تست توان جدید'}</DialogTitle>
            <DialogDescription>
              {editingId ? 'اطلاعات تست را ویرایش و ذخیره کنید.' : 'نتیجه اندازه‌گیری را دقیقاً مطابق دستگاه ثبت کنید.'}
            </DialogDescription>
          </DialogHeader>

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

            <Field label="محل تست" required error={errors.location}>
              <Input
                value={form.location}
                onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
                placeholder="مثلاً باکس ۱۲ — طبقه سوم واحد ۳"
                className="min-h-11"
              />
            </Field>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="مقدار اندازه‌گیری‌شده" required error={errors.value}>
                <NumberField
                  value={form.value}
                  onChange={(v) => setForm((f) => ({ ...f, value: v }))}
                  placeholder="0.00"
                />
              </Field>

              <Field label="واحد" required>
                <Select value={form.unit} onValueChange={(v) => setForm((f) => ({ ...f, unit: v as PowerUnit }))}>
                  <SelectTrigger className="min-h-11 w-full" aria-label="واحد توان">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent dir="rtl">
                    {Object.entries(powerUnitLabels).map(([k, label]) => (
                      <SelectItem key={k} value={k}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>

            {/* معادل تبدیل‌شده — فقط نمایش؛ هرگز ذخیره نمی‌شود */}
            {conversion && (
              <div className="flex w-fit items-center gap-1.5 rounded-full border border-dashed px-3 py-1.5 text-xs text-muted-foreground">
                <Calculator className="size-3.5 shrink-0 text-primary" />
                <span>
                  معادل محاسباتی:{' '}
                  <span dir="ltr" className="font-medium text-foreground">
                    {conversion.text} {conversion.targetUnit}
                  </span>
                </span>
              </div>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="تاریخ تست" required error={errors.date}>
                <JalaliDatePicker
                  value={form.date || undefined}
                  onChange={(iso) => setForm((f) => ({ ...f, date: iso ?? '' }))}
                  placeholder="انتخاب تاریخ"
                />
              </Field>

              <Field label="طول موج (اختیاری)">
                <NumberField
                  value={form.wavelengthNm}
                  onChange={(v) => setForm((f) => ({ ...f, wavelengthNm: v }))}
                  placeholder="1310 یا 1550"
                  unit="nm"
                />
              </Field>
            </div>

            <Field label="مدل دستگاه اندازه‌گیری (اختیاری)">
              <Input
                value={form.deviceModel}
                onChange={(e) => setForm((f) => ({ ...f, deviceModel: e.target.value }))}
                placeholder="مثلاً EXFO FPM-300"
                className="min-h-11"
              />
            </Field>

            <Field
              label="مسئول تست (اختیاری)"
              hint="نام مسئول در زمان ثبت ذخیره می‌شود؛ تغییر پروفایل بعدی سوابق را تغییر نمی‌دهد."
            >
              <Select
                value={form.assigneeProfileId ?? NONE}
                onValueChange={(v) => setFormProfile(v === NONE ? undefined : v)}
              >
                <SelectTrigger className="min-h-11 w-full" aria-label="مسئول تست">
                  <SelectValue placeholder="انتخاب مسئول" />
                </SelectTrigger>
                <SelectContent dir="rtl">
                  <SelectItem value={NONE}>— بدون مسئول —</SelectItem>
                  {(profiles ?? []).map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {[p.firstName, p.lastName].filter(Boolean).join(' ') || 'بدون نام'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label="توضیحات">
              <Textarea
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                rows={3}
                placeholder="توضیحات تکمیلی تست…"
              />
            </Field>

            {editingId && (
              <>
                <Separator />
                <section aria-label="عکس‌های تست توان" className="flex flex-col gap-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold">عکس‌های تست</span>
                    <PhotoPickerButton
                      link={{
                        projectId: form.projectId,
                        routeId: form.routeId,
                        boxId: form.boxId,
                        powerTestId: editingId,
                      }}
                      category="power_test"
                      baseTitle="صفحه دستگاه"
                      label="عکس صفحه دستگاه"
                      size="sm"
                    />
                  </div>
                  <PhotoGallery filter={{ powerTestId: editingId }} />
                </section>
              </>
            )}
          </div>

          <DialogFooter className="flex-row justify-start gap-2">
            <Button onClick={handleSave} disabled={busy} className="min-h-11 flex-1">
              {busy && <Loader2 className="size-4 animate-spin" />}
              {editingId ? 'ذخیره تغییرات' : 'ثبت و ذخیره'}
            </Button>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={busy} className="min-h-11 flex-1">
              بستن
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* تأیید حذف */}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(o) => {
          if (!o) setDeleteTarget(null)
        }}
        title={messages.deleteConfirmTitle}
        description={`حذف تست «${deleteTarget?.location ?? ''}» — ${messages.deleteConfirmDesc}`}
        confirmLabel="حذف"
        destructive
        loading={deleteBusy}
        onConfirm={confirmDelete}
      />
    </>
  )
}

// ================= کارت تست توان =================
function PowerTestCard({
  test: pt,
  boxMap,
  onEdit,
  onDelete,
}: {
  test: PowerTest
  boxMap: Map<string, Box>
  onEdit: (pt: PowerTest) => void
  onDelete: (pt: PowerTest) => void
}) {
  const box = pt.boxId ? boxMap.get(pt.boxId) : undefined

  return (
    <ItemCard
      title={
        <span dir="ltr" className="flex items-baseline gap-1.5">
          <span className="text-lg font-bold tabular-nums">{displayPowerValue(pt.value)}</span>
          <span className="text-xs font-medium text-muted-foreground">{pt.unit}</span>
        </span>
      }
      subtitle={
        <span className="flex items-center gap-1">
          <MapPin className="size-3.5 shrink-0" />
          {pt.location}
        </span>
      }
      meta={
        <>
          {pt.deviceModel.trim() && (
            <span className="flex items-center gap-1">
              <Gauge className="size-3.5 shrink-0" />
              {pt.deviceModel}
            </span>
          )}
          {pt.assigneeName && (
            <span className="flex items-center gap-1">
              <UserRound className="size-3.5 shrink-0" />
              {pt.assigneeName}
            </span>
          )}
          {pt.wavelengthNm !== undefined && (
            <span className="flex items-center gap-1">
              <Waves className="size-3.5 shrink-0" />
              {`${toFa(pt.wavelengthNm)} nm`}
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
            {formatJalali(pt.date)}
          </span>
        </>
      }
      trailing={<RowMenu onEdit={() => onEdit(pt)} onDelete={() => onDelete(pt)} />}
    />
  )
}

// ================= منوی ردیف =================
function RowMenu({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  return (
    <DropdownMenu dir="rtl">
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="size-11 shrink-0" aria-label="گزینه‌های بیشتر">
          <MoreVertical className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-32">
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
