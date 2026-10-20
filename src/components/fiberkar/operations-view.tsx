'use client'

// فایبرکار — عملیات اجرایی: ثبت/ویرایش/حذف عملیات با عکس و فیلتر پروژه/مسیر/باکس
// تمام داده‌ها به‌صورت محلی در IndexedDB ذخیره می‌شوند (کاملاً آفلاین).
import * as React from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { toast } from 'sonner'
import {
  Box as BoxIcon,
  Calendar,
  ClipboardList,
  FolderKanban,
  Loader2,
  MoreVertical,
  Package,
  Pencil,
  Plus,
  Route as RouteIcon,
  Trash2,
  UserRound,
  X,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
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
  createOperation,
  db,
  deleteOperationCascade,
  profileSnapshot,
  replaceOperationConsumables,
  updateOperation,
  type OperationConsumableRow,
  type OperationInput,
} from '@/lib/localdb'
import {
  consumableUnitLabels,
  messages,
  operationStatusLabels,
  operationStatusVariants,
  operationTypeLabels,
} from '@/lib/labels'
import { adaptiveNum, formatJalali, parseNumberInput, toFa, todayISO } from '@/lib/persian'
import type { Box, Operation, OperationStatus, OperationType, PhotoCategory, Project, Route } from '@/lib/types'
import { useAppStore } from '@/store/app-store'
import { PhotoGallery } from './photo-gallery'
import { PhotoPickerButton } from './photo-picker'
import { ConfirmDialog, EmptyState, Field, ItemCard, JalaliDatePicker, PageHeader, StatusBadge } from './primitives'
import { CsvExportButton } from './csv-export-button'

// مقدار «هیچ» برای Select های اختیاری/فیلتر
const NONE = 'none'

// ---------- کمکی‌ها ----------
function operationPhotoCategory(type: OperationType): PhotoCategory {
  switch (type) {
    case 'fusion':
      return 'fusion'
    case 'power_test':
      return 'power_test'
    case 'drop_cable':
      return 'drop_cable'
    case 'box_install':
      return 'box_install'
    default:
      return 'other'
  }
}

/** اطمینان از حضور گزینه انتخاب‌شده در فهرست (حتی اگر آرشیو شده باشد) */
function ensureSelected<T extends { id: string }>(list: T[], all: T[], selectedId: string | undefined): T[] {
  if (selectedId && !list.some((x) => x.id === selectedId)) {
    const current = all.find((x) => x.id === selectedId)
    if (current) return [...list, current]
  }
  return list
}

interface OperationForm {
  title: string
  type: OperationType
  customTypeLabel: string
  date: string
  status: OperationStatus
  projectId: string | undefined
  routeId: string | undefined
  boxId: string | undefined
  assigneeProfileId: string | undefined
  assigneeName: string
  assigneeRole: string
  description: string
  techSpecs: string
}

interface OperationErrors {
  title?: string
  date?: string
  projectId?: string
  customTypeLabel?: string
}

/** ردیف مواد مصرفی در فرم عملیات (قلم + مقدار) — v1.3.1 */
interface ConsumeRow {
  itemId: string | undefined
  qty: string
}

function emptyForm(projectId?: string, routeId?: string, boxId?: string): OperationForm {
  return {
    title: '',
    type: 'visit',
    customTypeLabel: '',
    date: todayISO(),
    status: 'planned',
    projectId,
    routeId,
    boxId,
    assigneeProfileId: undefined,
    assigneeName: '',
    assigneeRole: '',
    description: '',
    techSpecs: '',
  }
}

// ================= نمای عملیات اجرایی =================
export default function OperationsView() {
  const params = useAppStore((s) => s.params)
  const back = useAppStore((s) => s.back)

  // ---------- فیلترها (پیش‌فرض از پارامترهای ناوبری؛ قابل تغییر محلی) ----------
  const [filterProject, setFilterProject] = React.useState<string | undefined>(params.projectId)
  const [filterRoute, setFilterRoute] = React.useState<string | undefined>(params.routeId)
  const [filterBox, setFilterBox] = React.useState<string | undefined>(params.boxId)

  React.useEffect(() => {
    setFilterProject(params.projectId)
    setFilterRoute(params.routeId)
    setFilterBox(params.boxId)
  }, [params.projectId, params.routeId, params.boxId])

  // ---------- داده‌های واکنش‌گرا ----------
  const operations = useLiveQuery(async () => {
    let col = db.operations.orderBy('createdAt').reverse()
    if (filterProject) col = col.filter((o) => o.projectId === filterProject)
    if (filterRoute) col = col.filter((o) => o.routeId === filterRoute)
    if (filterBox) col = col.filter((o) => o.boxId === filterBox)
    return col.toArray()
  }, [filterProject, filterRoute, filterBox])

  const projects = useLiveQuery(() => db.projects.toArray(), [])
  const routes = useLiveQuery(() => db.routes.toArray(), [])
  const boxes = useLiveQuery(() => db.boxes.toArray(), [])
  const profiles = useLiveQuery(() => db.profiles.toArray(), [])

  const projectMap = React.useMemo(() => new Map((projects ?? []).map((p) => [p.id, p])), [projects])
  const routeMap = React.useMemo(() => new Map((routes ?? []).map((r) => [r.id, r])), [routes])
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

  const chipProject = filterProject ? projectMap.get(filterProject) : undefined
  const chipRoute = filterRoute ? routeMap.get(filterRoute) : undefined
  const chipBox = filterBox ? boxMap.get(filterBox) : undefined

  // ---------- دیالوگ فرم ----------
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [editingId, setEditingId] = React.useState<string | null>(null)
  const [form, setForm] = React.useState<OperationForm>(() =>
    emptyForm(params.projectId, params.routeId, params.boxId)
  )
  const [errors, setErrors] = React.useState<OperationErrors>({})
  const [busy, setBusy] = React.useState(false)
  // بنر موفقیت در حالت ایجاد (دیالوگ باز می‌ماند تا عکس با شناسه واقعی پیوست شود)
  const [created, setCreated] = React.useState(false)
  // مواد مصرف‌شده در این عملیات — ثبت مستقیم در لوازم مصرفی (v1.3.1)
  const [consumeRows, setConsumeRows] = React.useState<ConsumeRow[]>([])
  const consumableItems = useLiveQuery(() => db.consumableItems.orderBy('name').toArray(), [])

  // ---------- حذف ----------
  const [deleteTarget, setDeleteTarget] = React.useState<Operation | null>(null)
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
    setConsumeRows([])
    setDialogOpen(true)
  }

  function openEdit(op: Operation) {
    setForm({
      title: op.title,
      type: op.type,
      customTypeLabel: op.customTypeLabel,
      date: op.date,
      status: op.status,
      projectId: op.projectId,
      routeId: op.routeId,
      boxId: op.boxId,
      assigneeProfileId: op.assigneeProfileId,
      assigneeName: op.assigneeName,
      assigneeRole: op.assigneeRole,
      description: op.description,
      techSpecs: op.techSpecs,
    })
    setEditingId(op.id)
    setErrors({})
    setCreated(false)
    setConsumeRows([])
    setDialogOpen(true)
    // بارگیری مواد مصرفی ثبت‌شدهٔ این عملیات (خارج از مسیر رندر؛ خطا نادیده)
    void db.consumableUsages
      .where('operationId')
      .equals(op.id)
      .toArray()
      .then((rows) => {
        setConsumeRows(rows.map((u) => ({ itemId: u.itemId, qty: adaptiveNum(u.quantity) })))
      })
      .catch(() => {})
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

  function setFormProfile(id: string | undefined) {
    setForm((f) => {
      if (!id) return { ...f, assigneeProfileId: undefined, assigneeName: '', assigneeRole: '' }
      const p = (profiles ?? []).find((x) => x.id === id)
      if (!p) return { ...f, assigneeProfileId: id }
      const snap = profileSnapshot(p)
      return { ...f, assigneeProfileId: id, assigneeName: snap.name, assigneeRole: snap.role }
    })
  }

  // ---------- ردیف‌های مواد مصرفی ----------
  function addConsumeRow() {
    setConsumeRows((rows) => [...rows, { itemId: undefined, qty: '' }])
  }

  function updateConsumeRow(idx: number, patch: Partial<ConsumeRow>) {
    setConsumeRows((rows) => rows.map((r, i) => (i === idx ? { ...r, ...patch } : r)))
  }

  function removeConsumeRow(idx: number) {
    setConsumeRows((rows) => rows.filter((_, i) => i !== idx))
  }

  function validate(): OperationErrors {
    const errs: OperationErrors = {}
    if (!form.title.trim()) errs.title = 'عنوان عملیات الزامی است'
    if (!form.date) errs.date = 'تاریخ عملیات الزامی است'
    if (!form.projectId) errs.projectId = 'انتخاب پروژه الزامی است'
    if (form.type === 'custom' && !form.customTypeLabel.trim()) errs.customTypeLabel = 'عنوان نوع سفارشی الزامی است'
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
    // اعتبارسنجی ردیف‌های مواد مصرفی — ردیف کامل نامعتبر خطا می‌دهد، ردیف کاملاً خالی نادیده
    const validRows: OperationConsumableRow[] = []
    for (const r of consumeRows) {
      const q = r.qty.trim() ? parseNumberInput(r.qty) : undefined
      if (!r.itemId && q === undefined) continue // ردیف خالی
      if (!r.itemId || q === undefined || q <= 0) {
        toast.error('برای مواد مصرف‌شده، قلم و مقدار معتبر (بیشتر از صفر) را وارد کنید یا ردیف را حذف کنید')
        return
      }
      validRows.push({ itemId: r.itemId, quantity: q })
    }
    setBusy(true)
    try {
      // اسنپ‌شات مسئول: اگر پروفایل موجود باشد از وضعیت فعلی؛ در غیر این صورت اسنپ‌شات قبلی حفظ می‌شود
      const prof = form.assigneeProfileId ? (profiles ?? []).find((p) => p.id === form.assigneeProfileId) : undefined
      let assigneeProfileId: string | undefined
      let assigneeName: string
      let assigneeRole: string
      if (prof) {
        const snap = profileSnapshot(prof)
        assigneeProfileId = snap.profileId
        assigneeName = snap.name
        assigneeRole = snap.role
      } else if (form.assigneeProfileId) {
        assigneeProfileId = form.assigneeProfileId
        assigneeName = form.assigneeName
        assigneeRole = form.assigneeRole
      } else {
        assigneeName = ''
        assigneeRole = ''
      }

      const input: OperationInput = {
        projectId: form.projectId,
        routeId: form.routeId,
        boxId: form.boxId,
        type: form.type,
        customTypeLabel: form.customTypeLabel.trim(),
        title: form.title.trim(),
        date: form.date,
        status: form.status,
        assigneeProfileId,
        assigneeName,
        assigneeRole,
        description: form.description.trim(),
        techSpecs: form.techSpecs.trim(),
      }

      if (editingId) {
        await updateOperation(editingId, input)
        // همگام‌سازی مواد مصرفی با ردیف‌های فرم (تاریخ/والدین از خود عملیات)
        await replaceOperationConsumables(
          { id: editingId, date: input.date, projectId: input.projectId, routeId: input.routeId, boxId: input.boxId },
          validRows
        )
        toast.success(messages.updated)
        setDialogOpen(false)
      } else {
        const rec = await createOperation(input)
        // رفتن به حالت ویرایش تا بلافاصله بتوان عکس پیوست کرد
        setEditingId(rec.id)
        setErrors({})
        setCreated(true)
        // مواد مصرفی برای عملیات تازه‌ساخته‌شده هم ثبت می‌شود
        if (validRows.length > 0) {
          await replaceOperationConsumables(
            { id: rec.id, date: input.date, projectId: input.projectId, routeId: input.routeId, boxId: input.boxId },
            validRows
          )
        }
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
      await deleteOperationCascade(deleteTarget.id)
      toast.success(messages.deleted)
      setDeleteTarget(null)
    } catch {
      toast.error(messages.error)
    } finally {
      setDeleteBusy(false)
    }
  }

  // ---------- لینک عمیق: باز شدن خودکار ویرایش برای operationId (فقط یک بار در هر نشانی) ----------
  const deepLinkConsumedRef = React.useRef(false)
  React.useEffect(() => {
    deepLinkConsumedRef.current = false
  }, [params.operationId])
  React.useEffect(() => {
    if (deepLinkConsumedRef.current) return
    const id = params.operationId
    if (!id || !operations) return
    deepLinkConsumedRef.current = true
    const rec = operations.find((o) => o.id === id)
    if (rec) openEdit(rec)
     
  }, [operations, params.operationId])

  // ================= رندر =================
  return (
    <>
      <PageHeader
        title="عملیات اجرایی"
        subtitle={operations ? `${toFa(operations.length)} مورد` : undefined}
        onBack={back}
        actions={
          <div className="flex items-center gap-2">
            <CsvExportButton kind="operations" projectId={filterProject} className="min-h-11" />
            <Button onClick={openCreate} className="min-h-11">
              <Plus className="size-4" />
              ثبت جدید
            </Button>
          </div>
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

      {/* فهرست عملیات */}
      {operations === undefined ? (
        <div className="flex justify-center py-16">
          <Loader2 className="size-6 animate-spin text-muted-foreground" aria-label="در حال بارگذاری" />
        </div>
      ) : operations.length === 0 ? (
        <EmptyState
          icon={<ClipboardList className="size-10" />}
          title="موردی ثبت نشده است"
          hint="عملیات اجرایی پروژه‌ها را اینجا ثبت کنید؛ برای شروع یک عملیات جدید بسازید."
          actionLabel="ثبت عملیات جدید"
          onAction={openCreate}
        />
      ) : (
        <div className="flex flex-col gap-4">
          {operations.map((op) => (
            <OperationCard
              key={op.id}
              op={op}
              projectMap={projectMap}
              routeMap={routeMap}
              boxMap={boxMap}
              onEdit={openEdit}
              onDelete={setDeleteTarget}
            />
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
            <DialogTitle>{editingId ? 'ویرایش عملیات' : 'ثبت عملیات جدید'}</DialogTitle>
            <DialogDescription>
              {editingId
                ? 'اطلاعات عملیات را ویرایش و ذخیره کنید.'
                : 'اطلاعات عملیات اجرایی را تکمیل و ذخیره کنید.'}
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
            <Field label="عنوان عملیات" required error={errors.title}>
              <Input
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="مثلاً نصب باکس — خیابان ولیعصر"
                className="min-h-11"
              />
            </Field>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="نوع عملیات">
                <Select value={form.type} onValueChange={(v) => setForm((f) => ({ ...f, type: v as OperationType }))}>
                  <SelectTrigger className="min-h-11 w-full" aria-label="نوع عملیات">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent dir="rtl">
                    {Object.entries(operationTypeLabels).map(([k, label]) => (
                      <SelectItem key={k} value={k}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Field label="تاریخ" required error={errors.date}>
                <JalaliDatePicker
                  value={form.date || undefined}
                  onChange={(iso) => setForm((f) => ({ ...f, date: iso ?? '' }))}
                  placeholder="انتخاب تاریخ"
                />
              </Field>
            </div>

            {form.type === 'custom' && (
              <Field label="عنوان نوع سفارشی" required error={errors.customTypeLabel}>
                <Input
                  value={form.customTypeLabel}
                  onChange={(e) => setForm((f) => ({ ...f, customTypeLabel: e.target.value }))}
                  placeholder="مثلاً نصب تابلو توزیع"
                  className="min-h-11"
                />
              </Field>
            )}

            <Field label="وضعیت">
              <Select
                value={form.status}
                onValueChange={(v) => setForm((f) => ({ ...f, status: v as OperationStatus }))}
              >
                <SelectTrigger className="min-h-11 w-full" aria-label="وضعیت">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent dir="rtl">
                  {Object.entries(operationStatusLabels).map(([k, label]) => (
                    <SelectItem key={k} value={k}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

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
              <Select value={form.boxId ?? NONE} onValueChange={(v) => setForm((f) => ({ ...f, boxId: v === NONE ? undefined : v }))}>
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

            <Field
              label="مسئول اجرا (اختیاری)"
              hint="نام و نقش مسئول در زمان ثبت ذخیره می‌شود؛ تغییر پروفایل بعدی سوابق را تغییر نمی‌دهد."
            >
              <Select
                value={form.assigneeProfileId ?? NONE}
                onValueChange={(v) => setFormProfile(v === NONE ? undefined : v)}
              >
                <SelectTrigger className="min-h-11 w-full" aria-label="مسئول اجرا">
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

            {/* مواد مصرف‌شده — ثبت مستقیم در لوازم مصرفی (v1.3.1) */}
            <section aria-label="مواد مصرف‌شده" className="flex flex-col gap-3 rounded-xl border bg-muted/30 p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 text-sm font-semibold">
                    <Package className="size-4 shrink-0" />
                    مواد مصرف‌شده (اختیاری)
                  </div>
                  <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
                    اقلام مصرفی این عملیات (مثل آماده‌سازی باکس/کابل) به‌طور خودکار در بخش «لوازم مصرفی» و گزارش PDF ثبت می‌شود.
                  </p>
                </div>
                <Button type="button" variant="outline" size="sm" className="min-h-9 shrink-0" onClick={addConsumeRow}>
                  <Plus className="size-4" />
                  افزودن قلم
                </Button>
              </div>
              {consumeRows.length === 0 ? (
                <p className="text-xs text-muted-foreground">موردی اضافه نشده است.</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {consumeRows.map((row, idx) => (
                    <div
                      key={idx}
                      className="flex flex-col gap-2 rounded-lg border bg-background p-2 sm:flex-row sm:items-center"
                    >
                      <Select
                        value={row.itemId ?? NONE}
                        onValueChange={(v) => updateConsumeRow(idx, { itemId: v === NONE ? undefined : v })}
                      >
                        <SelectTrigger className="min-h-11 w-full flex-1" aria-label={`قلم ردیف ${toFa(idx + 1)}`}>
                          <SelectValue placeholder="انتخاب قلم از کاتالوگ" />
                        </SelectTrigger>
                        <SelectContent dir="rtl">
                          <SelectItem value={NONE}>— انتخاب قلم —</SelectItem>
                          {(consumableItems ?? []).map((it) => (
                            <SelectItem key={it.id} value={it.id}>
                              {`${it.name} (${consumableUnitLabels[it.unit]})`}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <div className="flex items-center gap-2">
                        <Input
                          value={row.qty}
                          onChange={(e) => updateConsumeRow(idx, { qty: e.target.value })}
                          inputMode="decimal"
                          dir="ltr"
                          placeholder="مقدار"
                          className="min-h-11 flex-1 sm:w-28 sm:flex-none"
                          aria-label={`مقدار ردیف ${toFa(idx + 1)}`}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-11 shrink-0 text-destructive hover:text-destructive"
                          onClick={() => removeConsumeRow(idx)}
                          aria-label={`حذف ردیف ${toFa(idx + 1)}`}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <Field label="توضیحات">
              <Textarea
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                rows={3}
                placeholder="توضیحات تکمیلی عملیات…"
              />
            </Field>

            <Field label="مشخصات فنی">
              <Textarea
                value={form.techSpecs}
                onChange={(e) => setForm((f) => ({ ...f, techSpecs: e.target.value }))}
                rows={3}
                placeholder="مشخصات فنی مرتبط با عملیات…"
              />
            </Field>

            {editingId && (
              <>
                <Separator />
                <section aria-label="عکس‌های عملیات" className="flex flex-col gap-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold">عکس‌های عملیات</span>
                    <PhotoPickerButton
                      link={{
                        projectId: form.projectId,
                        routeId: form.routeId,
                        boxId: form.boxId,
                        operationId: editingId,
                      }}
                      category={operationPhotoCategory(form.type)}
                      baseTitle={form.title.trim() || undefined}
                      size="sm"
                    />
                  </div>
                  <PhotoGallery filter={{ operationId: editingId }} />
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
        description={`حذف «${deleteTarget?.title ?? ''}» — ${messages.deleteConfirmDesc}`}
        confirmLabel="حذف"
        destructive
        loading={deleteBusy}
        onConfirm={confirmDelete}
      />
    </>
  )
}

// ================= کارت عملیات =================
function OperationCard({
  op,
  projectMap,
  routeMap,
  boxMap,
  onEdit,
  onDelete,
}: {
  op: Operation
  projectMap: Map<string, Project>
  routeMap: Map<string, Route>
  boxMap: Map<string, Box>
  onEdit: (op: Operation) => void
  onDelete: (op: Operation) => void
}) {
  const typeLabel =
    op.type === 'custom' ? op.customTypeLabel.trim() || operationTypeLabels.custom : operationTypeLabels[op.type]
  const project = op.projectId ? projectMap.get(op.projectId) : undefined
  const route = op.routeId ? routeMap.get(op.routeId) : undefined
  const box = op.boxId ? boxMap.get(op.boxId) : undefined
  // خلاصهٔ مواد مصرفی ثبت‌شدهٔ این عملیات (v1.3.1)
  const consumeSummary = useLiveQuery(async () => {
    const rows = await db.consumableUsages.where('operationId').equals(op.id).toArray()
    if (rows.length === 0) return undefined
    const items = await db.consumableItems.toArray()
    const byId = new Map(items.map((i) => [i.id, i]))
    return rows
      .map((u) => {
        const it = byId.get(u.itemId)
        const unit = it ? ` ${consumableUnitLabels[it.unit]}` : ''
        return `${it ? it.name : 'قلم حذف‌شده'} ${adaptiveNum(u.quantity)}${unit}`
      })
      .join(' • ')
  }, [op.id])

  return (
    <ItemCard
      title={op.title}
      badges={
        <>
          <Badge variant="outline" className="shrink-0">
            {typeLabel}
          </Badge>
          <StatusBadge label={operationStatusLabels[op.status]} variant={operationStatusVariants[op.status]} />
        </>
      }
      subtitle={
        <>
          {op.assigneeName ? (
            <span className="flex items-center gap-1">
              <UserRound className="size-3.5 shrink-0" />
              {`مسئول: ${op.assigneeName}${op.assigneeRole ? ` (${op.assigneeRole})` : ''}`}
            </span>
          ) : undefined}
          {consumeSummary && (
            <span className="flex items-start gap-1 text-xs text-muted-foreground">
              <Package className="mt-0.5 size-3.5 shrink-0" />
              {`مواد مصرف‌شده: ${consumeSummary}`}
            </span>
          )}
        </>
      }
      meta={
        <>
          <span className="flex items-center gap-1">
            <Calendar className="size-3.5 shrink-0" />
            {formatJalali(op.date)}
          </span>
          {project && (
            <span className="flex items-center gap-1">
              <FolderKanban className="size-3.5 shrink-0" />
              {project.name}
            </span>
          )}
          {route && (
            <span className="flex items-center gap-1">
              <RouteIcon className="size-3.5 shrink-0" />
              {route.name}
            </span>
          )}
          {box && (
            <span className="flex items-center gap-1">
              <BoxIcon className="size-3.5 shrink-0" />
              {`باکس ${box.number}`}
            </span>
          )}
        </>
      }
      trailing={<RowMenu onEdit={() => onEdit(op)} onDelete={() => onDelete(op)} />}
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
