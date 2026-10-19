'use client'

// فایبرکار — فهرست پروژه‌ها (جست‌وجو، فیلتر وضعیت، آرشیو، ایجاد/ویرایش/حذف)
import * as React from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  Archive,
  ArchiveRestore,
  FolderKanban,
  MoreVertical,
  Pencil,
  Plus,
  Search,
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
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import {
  ConfirmDialog,
  EmptyState,
  Field,
  ItemCard,
  JalaliDatePicker,
  PageHeader,
  SegmentedTabs,
  StatusBadge,
} from '@/components/fiberkar/primitives'
import { useAppStore } from '@/store/app-store'
import {
  createProject,
  db,
  deleteProjectCascade,
  setProjectArchived,
  updateProject,
  type ProjectInput,
} from '@/lib/localdb'
import { messages, projectStatusLabels, projectStatusVariants } from '@/lib/labels'
import { formatJalali, toFa } from '@/lib/persian'
import type { Profile, Project, ProjectStatus } from '@/lib/types'

// ---------- نمایش نام پروفایل ----------
function profileDisplayName(p: Profile): string {
  const name = `${p.firstName} ${p.lastName}`.trim()
  return name || p.company || 'بدون نام'
}

// ---------- فرم پروژه ----------
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

function projectToForm(p: Project): ProjectFormValues {
  return {
    name: p.name,
    code: p.code,
    client: p.client,
    area: p.area,
    startDate: p.startDate,
    status: p.status,
    contractorProfileId: p.contractorProfileId,
    executorProfileId: p.executorProfileId,
    description: p.description,
  }
}

function ProjectFormDialog({
  open,
  onOpenChange,
  editing,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
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
    if (open) {
      setForm(editing ? projectToForm(editing) : EMPTY_PROJECT_FORM)
      setErrors({})
    }
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
      } else {
        await createProject(input)
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
          <DialogTitle>{editing ? 'ویرایش پروژه' : 'پروژه جدید'}</DialogTitle>
          <DialogDescription>
            {editing ? 'اطلاعات پروژه را ویرایش کنید.' : 'اطلاعات پروژه جدید را وارد کنید؛ فیلدهای ستاره‌دار الزامی هستند.'}
          </DialogDescription>
        </DialogHeader>

        <div className="grid max-h-[60vh] gap-4 overflow-y-auto pe-1">
          <Field label="نام پروژه" required error={errors.name}>
            <Input
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              placeholder="مثلاً توسعه فیبر محله سعدی"
              className="min-h-11"
            />
          </Field>

          <Field label="کد پروژه" hint="اختیاری — کد قرارداد یا شناسه داخلی">
            <Input value={form.code} onChange={(e) => set('code', e.target.value)} placeholder="مثلاً PRJ-1404-01" className="min-h-11" dir="ltr" />
          </Field>

          <Field label="کارفرما" required error={errors.client}>
            <Input value={form.client} onChange={(e) => set('client', e.target.value)} placeholder="مثلاً مخابرات منطقه" className="min-h-11" />
          </Field>

          <Field label="محدوده" hint="منطقه جغرافیایی پروژه">
            <Input value={form.area} onChange={(e) => set('area', e.target.value)} placeholder="مثلاً شمال شهر" className="min-h-11" />
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
            <Textarea
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              placeholder="توضیحات تکمیلی پروژه…"
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

// ---------- منوی ردیف پروژه ----------
function ProjectRowMenu({
  project,
  onEdit,
  onArchive,
  onDelete,
}: {
  project: Project
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
          aria-label={`گزینه‌های پروژه ${project.name}`}
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
          {project.archived === 1 ? <ArchiveRestore className="size-4" /> : <Archive className="size-4" />}
          {project.archived === 1 ? 'خروج از آرشیو' : 'آرشیو'}
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
interface ProjectCounts {
  routes: number
  boxes: number
  photos: number
}

export default function ProjectsView() {
  const navigate = useAppStore((s) => s.navigate)

  const [search, setSearch] = React.useState('')
  const [statusFilter, setStatusFilter] = React.useState<string>('all')
  const [showArchive, setShowArchive] = React.useState(false)
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<Project | null>(null)
  const [deleteTarget, setDeleteTarget] = React.useState<Project | null>(null)
  const [deleting, setDeleting] = React.useState(false)

  const allProjects = useLiveQuery(async () => {
    const ps = await db.projects.toArray()
    return ps.sort((a, b) => b.createdAt - a.createdAt)
  }, [])

  const visible = React.useMemo(() => {
    if (!allProjects) return undefined
    const q = search.trim()
    return allProjects.filter((p) => {
      if (showArchive) {
        if (p.archived !== 1) return false
      } else if (p.archived !== 0) {
        return false
      }
      if (statusFilter !== 'all' && p.status !== (statusFilter as ProjectStatus)) return false
      if (q) {
        const hay = `${p.name} ${p.code} ${p.client} ${p.area}`
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [allProjects, search, statusFilter, showArchive])

  // شمارش مسیر/باکس/عکس هر پروژه در یک کوئری زنده
  const countsById = useLiveQuery(async () => {
    if (!visible) return undefined
    const map: Record<string, ProjectCounts> = {}
    await Promise.all(
      visible.map(async (p) => {
        const [routes, boxes, photos] = await Promise.all([
          db.routes.where('projectId').equals(p.id).filter((r) => !r.archived).count(),
          db.boxes.where('projectId').equals(p.id).filter((b) => !b.archived).count(),
          db.photos.where('projectId').equals(p.id).count(),
        ])
        map[p.id] = { routes, boxes, photos }
      })
    )
    return map
  }, [visible])

  function openCreate() {
    setEditing(null)
    setDialogOpen(true)
  }

  function openEdit(p: Project) {
    setEditing(p)
    setDialogOpen(true)
  }

  async function handleArchiveToggle(p: Project) {
    try {
      if (p.archived === 1) {
        await setProjectArchived(p.id, 0)
        toast.success(messages.unarchived)
      } else {
        await setProjectArchived(p.id, 1)
        toast.success(messages.archived)
      }
    } catch {
      toast.error(messages.error)
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await deleteProjectCascade(deleteTarget.id)
      toast.success(messages.deleted)
      setDeleteTarget(null)
    } catch {
      toast.error(messages.error)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="پروژه‌ها"
        subtitle="مدیریت پروژه‌های فیبر نوری"
        actions={
          <Button onClick={openCreate} className="min-h-11">
            <Plus className="size-4" />
            پروژه جدید
          </Button>
        }
      />

      {/* جست‌وجو و فیلترها */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="جست‌وجو بر اساس نام، کد، کارفرما یا محدوده…"
            className="min-h-11 pr-9"
            aria-label="جست‌وجوی پروژه"
          />
        </div>
        <SegmentedTabs
          value={statusFilter}
          onChange={setStatusFilter}
          options={[
            { value: 'all', label: 'همه' },
            ...(Object.entries(projectStatusLabels) as Array<[ProjectStatus, string]>).map(([value, label]) => ({
              value,
              label,
            })),
          ]}
        />
        <label className="flex w-fit cursor-pointer items-center gap-2 text-sm">
          <Switch checked={showArchive} onCheckedChange={setShowArchive} aria-label="نمایش آرشیو" />
          نمایش آرشیو
        </label>
      </div>

      {/* فهرست */}
      {visible === undefined ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <EmptyState
          icon={<FolderKanban className="size-10" />}
          title={showArchive ? 'آرشیو خالی است' : messages.emptyTitle}
          hint={
            showArchive
              ? 'با انتخاب «آرشیو» در منوی هر پروژه، پروژه‌ها به این بخش منتقل می‌شوند.'
              : 'پروژه‌ای مطابق جست‌وجو یا فیلتر فعلی یافت نشد. نخستین پروژه خود را بسازید.'
          }
          actionLabel={showArchive ? undefined : 'پروژه جدید'}
          onAction={showArchive ? undefined : openCreate}
        />
      ) : (
        <div className="space-y-3">
          {visible.map((p) => {
            const c = countsById?.[p.id]
            return (
              <ItemCard
                key={p.id}
                title={p.name}
                badges={
                  <>
                    <StatusBadge label={projectStatusLabels[p.status]} variant={projectStatusVariants[p.status]} />
                    {p.archived === 1 && <StatusBadge label="آرشیو" variant="outline" />}
                  </>
                }
                subtitle={[p.client, p.area].filter(Boolean).join(' • ')}
                meta={
                  <>
                    {p.code ? <span>کد: {toFa(p.code)}</span> : null}
                    {p.startDate ? <span>شروع: {formatJalali(p.startDate)}</span> : null}
                    {c ? (
                      <span>
                        {toFa(c.routes)} مسیر • {toFa(c.boxes)} باکس • {toFa(c.photos)} عکس
                      </span>
                    ) : null}
                  </>
                }
                onClick={() => navigate('project', { projectId: p.id })}
                trailing={
                  <ProjectRowMenu
                    project={p}
                    onEdit={() => openEdit(p)}
                    onArchive={() => handleArchiveToggle(p)}
                    onDelete={() => setDeleteTarget(p)}
                  />
                }
              />
            )
          })}
        </div>
      )}

      {/* دیالوگ ایجاد/ویرایش */}
      <ProjectFormDialog open={dialogOpen} onOpenChange={setDialogOpen} editing={editing} />

      {/* تأیید حذف */}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(o) => {
          if (!o) setDeleteTarget(null)
        }}
        title="تأیید حذف پروژه"
        description={`${deleteTarget ? `«${deleteTarget.name}» ${messages.deleteConfirmDesc}` : messages.deleteConfirmDesc}`}
        confirmLabel="حذف"
        destructive
        loading={deleting}
        onConfirm={handleDelete}
      />
    </div>
  )
}
