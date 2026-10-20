'use client'

// فایبرکار — ماژول لوازم مصرفی (v1.3): کاتالوگ اقلام، ثبت مصرف پروژه‌ها و گزارش تجمیعی
// ساختار بر اساس الگوی drop-cables-view: تب‌های سگمنتی، فرم دیالوگی، لیست با منوی ردیف و اعلان‌ها
import * as React from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { toast } from 'sonner'
import {
  ClipboardList,
  MoreVertical,
  Package,
  Pencil,
  Plus,
  Search,
  Trash2,
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
import {
  createConsumableItem,
  createConsumableUsage,
  db,
  deleteConsumableItemCascade,
  deleteConsumableUsage,
  updateConsumableItem,
  updateConsumableUsage,
} from '@/lib/localdb'
import {
  adaptiveNum,
  formatJalali,
  normalizeFa,
  parseNumberInput,
  toFa,
  todayISO,
  validateMeterage,
} from '@/lib/persian'
import { consumableCategoryLabels, consumableUnitLabels, messages } from '@/lib/labels'
import type {
  Box,
  ConsumableCategory,
  ConsumableItem,
  ConsumableUnit,
  ConsumableUsage,
  Project,
  Route,
} from '@/lib/types'
import {
  ConfirmDialog,
  EmptyState,
  Field,
  ItemCard,
  JalaliDatePicker,
  PageHeader,
  SegmentedTabs,
  StatusBadge,
} from './primitives'
import { CsvExportButton } from './csv-export-button'

const ALL = 'all'
const NONE = '__none__'

type ItemFormErrors = Partial<Record<'name', string>>
type UsageFormErrors = Partial<Record<'itemId' | 'quantity' | 'date', string>>

// ================= منوی ردیف (ویرایش/حذف) =================

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

// ================= نمای اصلی لوازم مصرفی =================

export default function ConsumablesView() {
  // ---------- داده‌ها (زنده از IndexedDB) ----------
  const items = useLiveQuery(() => db.consumableItems.orderBy('createdAt').toArray(), [])
  const allUsages = useLiveQuery(() => db.consumableUsages.orderBy('createdAt').reverse().toArray(), [])
  const allProjects = useLiveQuery(() => db.projects.toArray(), [])
  const allRoutes = useLiveQuery(() => db.routes.toArray(), [])
  const allBoxes = useLiveQuery(() => db.boxes.toArray(), [])

  // برای سلکت‌های فرم فقط رکوردهای غیرآرشیو؛ برای نمایش تاریخچه همه (حتی آرشیو) استفاده می‌شود
  const projects = React.useMemo(() => (allProjects ?? []).filter((p) => !p.archived), [allProjects])
  const routes = React.useMemo(() => (allRoutes ?? []).filter((r) => !r.archived), [allRoutes])
  const boxes = React.useMemo(() => (allBoxes ?? []).filter((b) => !b.archived), [allBoxes])

  const itemMap = React.useMemo(() => new Map((items ?? []).map((it) => [it.id, it])), [items])
  const projectMap = React.useMemo(() => new Map((allProjects ?? []).map((p) => [p.id, p])), [allProjects])
  const routeMap = React.useMemo(() => new Map((allRoutes ?? []).map((r) => [r.id, r])), [allRoutes])
  const boxMap = React.useMemo(() => new Map((allBoxes ?? []).map((b) => [b.id, b])), [allBoxes])

  // ---------- تب فعال و فیلترها ----------
  const [tab, setTab] = React.useState('items')
  const [search, setSearch] = React.useState('')
  const [reportProject, setReportProject] = React.useState<string>(ALL)

  const filteredItems = React.useMemo(() => {
    const list = items ?? []
    const tokens = normalizeFa(search).split(/\s+/).filter(Boolean)
    if (tokens.length === 0) return list
    return list.filter((it) => tokens.every((t) => normalizeFa(it.name).includes(t)))
  }, [items, search])

  // مصرف‌های اخیر (۳۰ مورد آخر) — همین کوئری برای گزارش تجمیعی هم استفاده می‌شود
  const recentUsages = React.useMemo(() => (allUsages ?? []).slice(0, 30), [allUsages])
  const reportUsages = React.useMemo(
    () => (allUsages ?? []).filter((u) => (reportProject === ALL ? true : u.projectId === reportProject)),
    [allUsages, reportProject]
  )

  // ---------- دیالوگ اقلام ----------
  const [itemFormOpen, setItemFormOpen] = React.useState(false)
  const [editingItem, setEditingItem] = React.useState<ConsumableItem | null>(null)
  const [itemDeleteId, setItemDeleteId] = React.useState<string | null>(null)
  const [deletingItem, setDeletingItem] = React.useState(false)

  const openItemCreate = () => {
    setEditingItem(null)
    setItemFormOpen(true)
  }
  const openItemEdit = (it: ConsumableItem) => {
    setEditingItem(it)
    setItemFormOpen(true)
  }

  const deleteItemTarget = itemDeleteId ? (items ?? []).find((it) => it.id === itemDeleteId) ?? null : null

  const handleDeleteItem = async () => {
    if (!itemDeleteId) return
    setDeletingItem(true)
    try {
      await deleteConsumableItemCascade(itemDeleteId)
      toast.success(messages.deleted)
      setItemDeleteId(null)
    } catch {
      toast.error(messages.error)
    } finally {
      setDeletingItem(false)
    }
  }

  // ---------- دیالوگ مصرف ----------
  const [usageFormOpen, setUsageFormOpen] = React.useState(false)
  const [editingUsage, setEditingUsage] = React.useState<ConsumableUsage | null>(null)
  const [usageDeleteId, setUsageDeleteId] = React.useState<string | null>(null)
  const [deletingUsage, setDeletingUsage] = React.useState(false)

  const openUsageCreate = () => {
    setEditingUsage(null)
    setUsageFormOpen(true)
  }
  const openUsageEdit = (u: ConsumableUsage) => {
    setEditingUsage(u)
    setUsageFormOpen(true)
  }

  const handleDeleteUsage = async () => {
    if (!usageDeleteId) return
    setDeletingUsage(true)
    try {
      await deleteConsumableUsage(usageDeleteId)
      toast.success(messages.deleted)
      setUsageDeleteId(null)
    } catch {
      toast.error(messages.error)
    } finally {
      setDeletingUsage(false)
    }
  }

  // ---------- رندر کارت مصرف (مشترک بین تب ثبت و تب گزارش) ----------
  const renderUsageCard = (u: ConsumableUsage, interactive: boolean) => {
    const item = itemMap.get(u.itemId)
    const box = u.boxId ? boxMap.get(u.boxId) : undefined
    const title = item
      ? `${item.name} — ${adaptiveNum(u.quantity)} ${consumableUnitLabels[item.unit]}`
      : `قلم حذف‌شده — ${adaptiveNum(u.quantity)}`
    const parts: string[] = [
      formatJalali(u.date),
      u.projectId ? (projectMap.get(u.projectId)?.name ?? '') : '',
      u.routeId ? (routeMap.get(u.routeId)?.name ?? '') : '',
      box ? `باکس ${toFa(box.number)}` : '',
      u.note || '',
    ].filter(Boolean)
    return (
      <ItemCard
        key={u.id}
        title={title}
        subtitle={parts.join(' • ') || undefined}
        onClick={interactive ? () => openUsageEdit(u) : undefined}
        trailing={
          interactive ? (
            <RowMenu name={title} onEdit={() => openUsageEdit(u)} onDelete={() => setUsageDeleteId(u.id)} />
          ) : undefined
        }
      />
    )
  }

  // ---------- گزارش تجمیعی: جمع مصرف به تفکیک قلم ----------
  const reportRows = React.useMemo(() => {
    const sums = new Map<string, number>()
    for (const u of reportUsages) sums.set(u.itemId, (sums.get(u.itemId) ?? 0) + u.quantity)
    const rows = Array.from(sums.entries()).map(([itemId, total]) => {
      const item = itemMap.get(itemId)
      return {
        itemId,
        name: item ? item.name : 'قلم حذف‌شده',
        category: item ? consumableCategoryLabels[item.category] : '—',
        unit: item ? consumableUnitLabels[item.unit] : '—',
        total,
      }
    })
    rows.sort((a, b) => a.name.localeCompare(b.name, 'fa'))
    return rows
  }, [reportUsages, itemMap])

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="لوازم مصرفی" subtitle="کاتالوگ اقلام و ثبت مصرف پروژه‌ها" />

      <SegmentedTabs
        value={tab}
        onChange={setTab}
        options={[
          { value: 'items', label: 'اقلام' },
          { value: 'usages', label: 'ثبت مصرف' },
          { value: 'report', label: 'گزارش مصرف' },
        ]}
      />

      {/* ======== تب ۱: کاتالوگ اقلام ======== */}
      {tab === 'items' && (
        <section aria-label="کاتالوگ اقلام" className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-base font-bold">
              اقلام کاتالوگ
              <span className="mr-1.5 text-sm font-normal text-muted-foreground">({toFa(filteredItems.length)})</span>
            </h2>
            <Button onClick={openItemCreate} className="min-h-11">
              <Plus className="size-4" />
              قلم جدید
            </Button>
          </div>

          <div className="relative">
            <Search className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="جست‌وجوی نام قلم…"
              aria-label="جست‌وجوی اقلام"
              className="min-h-11 pr-9"
            />
          </div>

          {items === undefined ? (
            <div className="flex flex-col gap-4" aria-label="در حال بارگذاری">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-20 rounded-xl" />
              ))}
            </div>
          ) : filteredItems.length === 0 ? (
            search.trim() ? (
              <EmptyState
                icon={<Search className="size-10" />}
                title="با این جست‌وجو موردی یافت نشد"
                hint="عبارت جست‌وجو را تغییر دهید."
              />
            ) : (
              <EmptyState
                icon={<Package className="size-10" />}
                title="هنوز قلمی در کاتالوگ نیست"
                hint="قلم‌های مصرفی مثل پیگتیل، آداپتور و لوله فیوژن را این‌جا تعریف کنید."
                actionLabel="قلم جدید"
                onAction={openItemCreate}
              />
            )
          ) : (
            <div className="flex flex-col gap-4">
              {filteredItems.map((it) => {
                const sub = [consumableCategoryLabels[it.category], consumableUnitLabels[it.unit], it.note]
                  .filter(Boolean)
                  .join(' • ')
                return (
                  <ItemCard
                    key={it.id}
                    title={it.name}
                    subtitle={sub || undefined}
                    badges={<StatusBadge label={consumableCategoryLabels[it.category]} variant="outline" />}
                    onClick={() => openItemEdit(it)}
                    trailing={
                      <RowMenu name={it.name} onEdit={() => openItemEdit(it)} onDelete={() => setItemDeleteId(it.id)} />
                    }
                  />
                )
              })}
            </div>
          )}
        </section>
      )}

      {/* ======== تب ۲: ثبت مصرف ======== */}
      {tab === 'usages' && (
        <section aria-label="ثبت مصرف" className="flex flex-col gap-4">
          <Button onClick={openUsageCreate} className="min-h-11 w-full sm:w-auto sm:self-start">
            <Plus className="size-4" />
            ثبت مصرف جدید
          </Button>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-base font-bold">
              مصرف‌های اخیر
              <span className="mr-1.5 text-sm font-normal text-muted-foreground">({toFa(recentUsages.length)})</span>
            </h2>
            {(allUsages?.length ?? 0) > 30 && (
              <span className="text-xs text-muted-foreground">
                نمایش {toFa(30)} مورد اخیر از {toFa(allUsages?.length ?? 0)} مورد
              </span>
            )}
          </div>

          {allUsages === undefined ? (
            <div className="flex flex-col gap-4" aria-label="در حال بارگذاری">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-20 rounded-xl" />
              ))}
            </div>
          ) : recentUsages.length === 0 ? (
            <EmptyState
              icon={<ClipboardList className="size-10" />}
              title="هنوز مصرفی ثبت نشده است"
              hint="مصرف اقلام را با مقدار، تاریخ و لینک اختیاری به پروژه ثبت کنید."
              actionLabel="ثبت مصرف جدید"
              onAction={openUsageCreate}
            />
          ) : (
            <div className="flex flex-col gap-4">{recentUsages.map((u) => renderUsageCard(u, true))}</div>
          )}
        </section>
      )}

      {/* ======== تب ۳: گزارش مصرف ======== */}
      {tab === 'report' && (
        <section aria-label="گزارش مصرف" className="flex flex-col gap-4">
          <div className="flex flex-wrap items-end justify-between gap-3 rounded-xl border bg-card p-4">
            <div className="flex min-w-48 flex-1 flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">پروژه</Label>
              <Select value={reportProject} onValueChange={setReportProject}>
                <SelectTrigger className="min-h-11 w-full" aria-label="فیلتر پروژه در گزارش">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent dir="rtl">
                  <SelectItem value={ALL}>همهٔ پروژه‌ها</SelectItem>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <CsvExportButton
              kind="consumables"
              projectId={reportProject !== ALL ? reportProject : undefined}
              className="min-h-11"
            />
          </div>

          {reportRows.length === 0 ? (
            <EmptyState
              icon={<ClipboardList className="size-10" />}
              title="مصرفی ثبت نشده است"
              hint={
                reportProject !== ALL
                  ? 'با فیلتر پروژهٔ انتخاب‌شده مصرفی یافت نشد؛ فیلتر را تغییر دهید.'
                  : 'پس از ثبت مصرف، گزارش تجمیعی اقلام این‌جا نمایش داده می‌شود.'
              }
            />
          ) : (
            <>
              {/* جدول تجمیعی — جمع مصرف به تفکیک قلم */}
              <div className="overflow-x-auto rounded-xl border">
                <table className="w-full min-w-[420px] text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="px-3 py-2.5 text-right font-semibold">قلم</th>
                      <th className="px-3 py-2.5 text-right font-semibold">دسته</th>
                      <th className="px-3 py-2.5 text-right font-semibold">واحد</th>
                      <th className="px-3 py-2.5 text-right font-semibold">مجموع مصرف</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportRows.map((r) => (
                      <tr key={r.itemId} className="border-b last:border-b-0">
                        <td className="px-3 py-2.5 font-medium">{r.name}</td>
                        <td className="px-3 py-2.5 text-muted-foreground">{r.category}</td>
                        <td className="px-3 py-2.5 text-muted-foreground">{r.unit}</td>
                        <td className="px-3 py-2.5 font-bold tabular-nums">{adaptiveNum(r.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-muted/30">
                      <td colSpan={3} className="px-3 py-2.5 font-semibold">
                        مجموع اقلام
                      </td>
                      <td className="px-3 py-2.5 font-bold tabular-nums">{toFa(reportRows.length)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* جزئیات مصرف‌های منطبق با فیلتر */}
              <h3 className="text-sm font-semibold text-muted-foreground">
                جزئیات مصرف‌ها
                <span className="mr-1.5 text-xs font-normal">({toFa(reportUsages.length)})</span>
              </h3>
              <div className="flex flex-col gap-4">{reportUsages.map((u) => renderUsageCard(u, false))}</div>
            </>
          )}
        </section>
      )}

      {/* فرم قلم (ایجاد/ویرایش) */}
      <ConsumableItemFormDialog
        open={itemFormOpen}
        editing={editingItem}
        onClose={() => {
          setItemFormOpen(false)
          setEditingItem(null)
        }}
      />

      {/* فرم ثبت/ویرایش مصرف */}
      <ConsumableUsageFormDialog
        open={usageFormOpen}
        editing={editingUsage}
        items={items ?? []}
        projects={projects}
        routes={routes}
        boxes={boxes}
        onClose={() => {
          setUsageFormOpen(false)
          setEditingUsage(null)
        }}
      />

      {/* تأیید حذف قلم — همهٔ مصرف‌های ثبت‌شدهٔ آن هم حذف می‌شود */}
      <ConfirmDialog
        open={!!itemDeleteId}
        onOpenChange={(o) => {
          if (!o) setItemDeleteId(null)
        }}
        title="حذف قلم کاتالوگ"
        description={`${deleteItemTarget ? `قلم «${deleteItemTarget.name}» به‌همراه همهٔ مصرف‌های ثبت‌شدهٔ آن حذف می‌شود. ` : ''}این عمل بازگشت‌پذیر نیست.`}
        confirmLabel="حذف"
        destructive
        loading={deletingItem}
        onConfirm={handleDeleteItem}
      />

      {/* تأیید حذف ثبت مصرف */}
      <ConfirmDialog
        open={!!usageDeleteId}
        onOpenChange={(o) => {
          if (!o) setUsageDeleteId(null)
        }}
        title="حذف ثبت مصرف"
        description="این ثبت مصرف حذف می‌شود. این عمل بازگشت‌پذیر نیست."
        confirmLabel="حذف"
        destructive
        loading={deletingUsage}
        onConfirm={handleDeleteUsage}
      />
    </div>
  )
}

// ================= فرم ایجاد/ویرایش قلم کاتالوگ =================

interface ConsumableItemFormValues {
  name: string
  category: ConsumableCategory
  unit: ConsumableUnit
  note: string
}

function defaultItemFormValues(): ConsumableItemFormValues {
  return { name: '', category: 'connector', unit: 'count', note: '' }
}

function itemFormValuesFromRecord(it: ConsumableItem): ConsumableItemFormValues {
  return { name: it.name, category: it.category, unit: it.unit, note: it.note }
}

function ConsumableItemFormDialog({
  open,
  editing,
  onClose,
}: {
  open: boolean
  editing: ConsumableItem | null
  onClose: () => void
}) {
  const [values, setValues] = React.useState<ConsumableItemFormValues>(() => defaultItemFormValues())
  const [errors, setErrors] = React.useState<ItemFormErrors>({})
  const [saving, setSaving] = React.useState(false)

  React.useEffect(() => {
    if (!open) return
    setErrors({})
    setValues(editing ? itemFormValuesFromRecord(editing) : defaultItemFormValues())
  }, [open, editing])

  const setField = <K extends keyof ConsumableItemFormValues>(key: K, v: ConsumableItemFormValues[K]) => {
    setValues((f) => ({ ...f, [key]: v }))
    setErrors((e) => ({ ...e, [key]: undefined }))
  }

  const handleSave = async () => {
    const errs: ItemFormErrors = {}
    if (!values.name.trim()) errs.name = 'نام قلم الزامی است'
    if (Object.values(errs).some(Boolean)) {
      setErrors(errs)
      toast.error(Object.values(errs).find(Boolean) || messages.requiredMissing)
      return
    }

    const payload = {
      name: values.name.trim(),
      category: values.category,
      unit: values.unit,
      note: values.note.trim(),
    }

    setSaving(true)
    try {
      if (editing) {
        await updateConsumableItem(editing.id, payload)
        toast.success(messages.updated)
      } else {
        await createConsumableItem(payload)
        toast.success(messages.saved)
      }
      onClose()
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
          <DialogTitle className="text-base">{editing ? 'ویرایش قلم' : 'قلم جدید'}</DialogTitle>
          <DialogDescription className="text-xs">
            نام، دسته و واحد شمارش قلم مصرفی را مشخص کنید
          </DialogDescription>
        </DialogHeader>

        <form
          id="consumable-item-form"
          onSubmit={(e) => {
            e.preventDefault()
            handleSave()
          }}
          className="flex flex-col gap-3 overflow-y-auto p-4"
        >
          <Field label="نام قلم" required error={errors.name}>
            <Input
              value={values.name}
              onChange={(e) => setField('name', e.target.value)}
              placeholder="مثلاً: پیگتیل SC"
              className="min-h-11"
            />
          </Field>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="دسته" required>
              <Select value={values.category} onValueChange={(v) => setField('category', v as ConsumableCategory)}>
                <SelectTrigger className="min-h-11 w-full" aria-label="انتخاب دسته">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent dir="rtl">
                  {(Object.keys(consumableCategoryLabels) as ConsumableCategory[]).map((c) => (
                    <SelectItem key={c} value={c}>
                      {consumableCategoryLabels[c]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label="واحد شمارش" required>
              <Select value={values.unit} onValueChange={(v) => setField('unit', v as ConsumableUnit)}>
                <SelectTrigger className="min-h-11 w-full" aria-label="انتخاب واحد شمارش">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent dir="rtl">
                  {(Object.keys(consumableUnitLabels) as ConsumableUnit[]).map((un) => (
                    <SelectItem key={un} value={un}>
                      {consumableUnitLabels[un]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          <Field label="توضیحات">
            <Textarea
              value={values.note}
              onChange={(e) => setField('note', e.target.value)}
              rows={3}
              placeholder="اختیاری"
            />
          </Field>
        </form>

        <DialogFooter className="flex-row justify-start gap-2 border-t p-4">
          <Button type="submit" form="consumable-item-form" disabled={saving} className="min-h-11 flex-1">
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

// ================= فرم ثبت/ویرایش مصرف =================

interface ConsumableUsageFormValues {
  itemId: string
  quantity: string // متن خام ورودی — با parseNumberInput پارس می‌شود
  date: string
  projectId: string
  routeId: string
  boxId: string
  note: string
}

function defaultUsageFormValues(): ConsumableUsageFormValues {
  return { itemId: '', quantity: '', date: todayISO(), projectId: '', routeId: '', boxId: '', note: '' }
}

function usageFormValuesFromRecord(u: ConsumableUsage): ConsumableUsageFormValues {
  return {
    itemId: u.itemId,
    quantity: String(u.quantity),
    date: u.date,
    projectId: u.projectId ?? '',
    routeId: u.routeId ?? '',
    boxId: u.boxId ?? '',
    note: u.note,
  }
}

function ConsumableUsageFormDialog({
  open,
  editing,
  items,
  projects,
  routes,
  boxes,
  onClose,
}: {
  open: boolean
  editing: ConsumableUsage | null
  items: ConsumableItem[]
  projects: Project[]
  routes: Route[]
  boxes: Box[]
  onClose: () => void
}) {
  const [values, setValues] = React.useState<ConsumableUsageFormValues>(() => defaultUsageFormValues())
  const [errors, setErrors] = React.useState<UsageFormErrors>({})
  const [saving, setSaving] = React.useState(false)

  React.useEffect(() => {
    if (!open) return
    setErrors({})
    setValues(editing ? usageFormValuesFromRecord(editing) : defaultUsageFormValues())
  }, [open, editing])

  const setField = <K extends keyof ConsumableUsageFormValues>(key: K, v: ConsumableUsageFormValues[K]) => {
    setValues((f) => ({ ...f, [key]: v }))
    setErrors((e) => ({ ...e, [key]: undefined }))
  }

  // سلکت‌های آبشاری: مسیر وابسته به پروژه، باکس وابسته به پروژه (+مسیر در صورت انتخاب)
  const formRoutes = React.useMemo(() => routes.filter((r) => r.projectId === values.projectId), [routes, values.projectId])
  const formBoxes = React.useMemo(
    () =>
      boxes.filter((b) => b.projectId === values.projectId && (!values.routeId || b.routeId === values.routeId)),
    [boxes, values.projectId, values.routeId]
  )
  const selectedItem = React.useMemo(() => items.find((it) => it.id === values.itemId), [items, values.itemId])

  const handleSave = async () => {
    const errs: UsageFormErrors = {}
    if (!values.itemId) errs.itemId = 'انتخاب قلم الزامی است'

    const quantity = parseNumberInput(values.quantity)
    if (quantity === undefined) {
      errs.quantity = values.quantity.trim() === '' ? 'مقدار مصرف الزامی است' : 'مقدار مصرف واردشده معتبر نیست'
    } else {
      const e = validateMeterage(quantity, 'مقدار مصرف')
      if (e) errs.quantity = e
      else if (quantity === 0) errs.quantity = 'مقدار مصرف باید بیشتر از صفر باشد'
    }

    if (!values.date) errs.date = 'تاریخ الزامی است'

    if (quantity === undefined || Object.values(errs).some(Boolean)) {
      setErrors(errs)
      toast.error(Object.values(errs).find(Boolean) || messages.requiredMissing)
      return
    }

    const payload = {
      itemId: values.itemId,
      quantity,
      date: values.date,
      projectId: values.projectId || undefined,
      routeId: values.routeId || undefined,
      boxId: values.boxId || undefined,
      note: values.note.trim(),
    }

    setSaving(true)
    try {
      if (editing) {
        await updateConsumableUsage(editing.id, payload)
        toast.success(messages.updated)
      } else {
        await createConsumableUsage(payload)
        toast.success(messages.saved)
      }
      onClose()
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
          <DialogTitle className="text-base">{editing ? 'ویرایش ثبت مصرف' : 'ثبت مصرف جدید'}</DialogTitle>
          <DialogDescription className="text-xs">
            قلم، مقدار و تاریخ مصرف را وارد کنید؛ لینک به پروژه/مسیر/باکس اختیاری است
          </DialogDescription>
        </DialogHeader>

        <form
          id="consumable-usage-form"
          onSubmit={(e) => {
            e.preventDefault()
            handleSave()
          }}
          className="flex flex-col gap-3 overflow-y-auto p-4"
        >
          <Field
            label="قلم"
            required
            error={errors.itemId}
            hint={items.length === 0 ? 'هنوز قلمی در کاتالوگ نیست — ابتدا از تب «اقلام» قلم اضافه کنید' : undefined}
          >
            <Select value={values.itemId || undefined} onValueChange={(v) => setField('itemId', v)}>
              <SelectTrigger className="min-h-11 w-full" aria-label="انتخاب قلم">
                <SelectValue placeholder="انتخاب قلم" />
              </SelectTrigger>
              <SelectContent dir="rtl">
                {items.map((it) => (
                  <SelectItem key={it.id} value={it.id}>
                    {it.name} ({consumableUnitLabels[it.unit]})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field
              label="مقدار مصرف"
              required
              error={errors.quantity}
              hint={selectedItem ? `واحد شمارش: ${consumableUnitLabels[selectedItem.unit]}` : undefined}
            >
              <Input
                value={values.quantity}
                onChange={(e) => setField('quantity', e.target.value)}
                inputMode="decimal"
                dir="ltr"
                placeholder="مثلاً: 12 یا 3.5"
                className="min-h-11"
              />
            </Field>

            <Field label="تاریخ" required error={errors.date}>
              <JalaliDatePicker value={values.date || undefined} onChange={(iso) => setField('date', iso ?? '')} />
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="پروژه" hint="اختیاری">
              <Select
                value={values.projectId || undefined}
                onValueChange={(v) => {
                  // تغییر پروژه، مسیر و باکس انتخاب‌شده را هم پاک می‌کند
                  setValues((f) => ({ ...f, projectId: v === NONE ? '' : v, routeId: '', boxId: '' }))
                }}
              >
                <SelectTrigger className="min-h-11 w-full" aria-label="انتخاب پروژه">
                  <SelectValue placeholder="بدون لینک" />
                </SelectTrigger>
                <SelectContent dir="rtl">
                  <SelectItem value={NONE}>— بدون لینک —</SelectItem>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label="مسیر" hint={values.projectId ? undefined : 'ابتدا پروژه را انتخاب کنید'}>
              <Select
                value={values.routeId || undefined}
                disabled={!values.projectId}
                onValueChange={(v) => {
                  setValues((f) => ({ ...f, routeId: v === NONE ? '' : v, boxId: '' }))
                }}
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
          </div>

          <Field label="باکس" hint={values.projectId ? undefined : 'ابتدا پروژه را انتخاب کنید'}>
            <Select
              value={values.boxId || undefined}
              disabled={!values.projectId}
              onValueChange={(v) => setField('boxId', v === NONE ? '' : v)}
            >
              <SelectTrigger className="min-h-11 w-full" aria-label="انتخاب باکس">
                <SelectValue placeholder="بدون باکس" />
              </SelectTrigger>
              <SelectContent dir="rtl">
                <SelectItem value={NONE}>— بدون باکس —</SelectItem>
                {formBoxes.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    باکس {toFa(b.number)}
                    {b.location ? ` — ${b.location}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label="توضیحات">
            <Textarea
              value={values.note}
              onChange={(e) => setField('note', e.target.value)}
              rows={3}
              placeholder="اختیاری"
            />
          </Field>
        </form>

        <DialogFooter className="flex-row justify-start gap-2 border-t p-4">
          <Button type="submit" form="consumable-usage-form" disabled={saving} className="min-h-11 flex-1">
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
