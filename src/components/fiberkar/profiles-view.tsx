'use client'

// فایبرکار — پروفایل و مشخصات کاری: لیست افراد، نقش‌ها، مشخصات نقش‌محور
// پروفایل‌ها کاملاً محلی هستند؛ هنگام ثبت عملیات، نام/نقش به‌صورت اسنپ‌شات لحظه‌ای ذخیره می‌شود.
import * as React from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { toast } from 'sonner'
import { Info, MoreVertical, Pencil, Plus, Trash2, UserRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
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
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { useAppStore } from '@/store/app-store'
import { createProfile, db, deleteProfileSafe, updateProfile } from '@/lib/localdb'
import type { ProfileInput } from '@/lib/localdb'
import { toFa } from '@/lib/persian'
import { messages, profileRoleLabels } from '@/lib/labels'
import type { Profile, ProfileRole } from '@/lib/types'
import { cn } from '@/lib/utils'
import { ConfirmDialog, EmptyState, Field, ItemCard, PageHeader, StatusBadge } from './primitives'

const ALL_ROLES = Object.keys(profileRoleLabels) as ProfileRole[]

type ProfileFormErrors = Partial<Record<'firstName' | 'lastName' | 'customRoleLabel', string>>

interface ProfileFormValues {
  firstName: string
  lastName: string
  phone: string
  company: string
  city: string
  description: string
  roles: ProfileRole[]
  customRoleLabel: string
  contractorArea: string
  fusionDevice: string
  testDevice: string
  dropCableType: string
  dropMethod: string
}

function defaultProfileValues(): ProfileFormValues {
  return {
    firstName: '',
    lastName: '',
    phone: '',
    company: '',
    city: '',
    description: '',
    roles: [],
    customRoleLabel: '',
    contractorArea: '',
    fusionDevice: '',
    testDevice: '',
    dropCableType: '',
    dropMethod: '',
  }
}

function profileValuesFromRecord(p: Profile): ProfileFormValues {
  return {
    firstName: p.firstName,
    lastName: p.lastName,
    phone: p.phone,
    company: p.company,
    city: p.city,
    description: p.description,
    roles: [...p.roles],
    customRoleLabel: p.customRoleLabel,
    contractorArea: p.roleData.contractorArea ?? '',
    fusionDevice: p.roleData.fusionDevice ?? '',
    testDevice: p.roleData.testDevice ?? '',
    dropCableType: p.roleData.dropCableType ?? '',
    dropMethod: p.roleData.dropMethod ?? '',
  }
}

function roleBadgeLabel(p: Profile, role: ProfileRole): string {
  return role === 'custom' ? p.customRoleLabel || profileRoleLabels.custom : profileRoleLabels[role]
}

// ================= نمای اصلی پروفایل‌ها =================

export default function ProfilesView() {
  const back = useAppStore((s) => s.back)

  const profiles = useLiveQuery(() => db.profiles.toArray(), [])

  const sorted = React.useMemo(() => {
    if (!profiles) return []
    return [...profiles].sort((a, b) =>
      `${a.firstName} ${a.lastName}`.trim().localeCompare(`${b.firstName} ${b.lastName}`.trim(), 'fa')
    )
  }, [profiles])

  const [formOpen, setFormOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<Profile | null>(null)
  const [deleteId, setDeleteId] = React.useState<string | null>(null)
  const [deleting, setDeleting] = React.useState(false)

  const openCreate = () => {
    setEditing(null)
    setFormOpen(true)
  }
  const openEdit = (p: Profile) => {
    setEditing(p)
    setFormOpen(true)
  }

  const deleteTarget = deleteId ? (profiles ?? []).find((p) => p.id === deleteId) ?? null : null

  const handleDelete = async () => {
    if (!deleteId) return
    setDeleting(true)
    try {
      await deleteProfileSafe(deleteId)
      toast.success(messages.deleted)
      setDeleteId(null)
    } catch {
      toast.error(messages.error)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="پروفایل و مشخصات کاری"
        subtitle="افراد، نقش‌ها و مشخصات کاری — کاملاً محلی"
        onBack={back}
        actions={
          <Button onClick={openCreate} className="min-h-11">
            <Plus className="size-4" />
            افزودن پروفایل
          </Button>
        }
      />

      {/* بنر اطلاع‌رسانی اسنپ‌شات */}
      <div className="flex items-start gap-2 rounded-xl border bg-primary/5 p-4 text-xs leading-6 text-muted-foreground">
        <Info className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
        <p>
          پروفایل‌ها محلی هستند و حساب آنلاین محسوب نمی‌شوند. هنگام ثبت عملیات، نام و نقش شما به‌صورت لحظه‌ای در رکورد
          ذخیره می‌شود تا تغییر بعدی پروفایل، سوابق قدیمی را تغییر ندهد.
        </p>
      </div>

      {/* لیست */}
      {profiles === undefined ? (
        <div className="flex flex-col gap-4" aria-label="در حال بارگذاری">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      ) : sorted.length === 0 ? (
        <EmptyState
          icon={<UserRound className="size-10" />}
          title="پروفایلی ثبت نشده است"
          hint="برای ثبت مجری‌ها، تکنسین‌ها و پیمانکارها اولین پروفایل را بسازید؛ سپس هنگام ثبت عملیات قابل انتخاب خواهد بود."
          actionLabel="افزودن پروفایل"
          onAction={openCreate}
        />
      ) : (
        <div className="flex flex-col gap-4">
          {sorted.map((p) => (
            <ItemCard
              key={p.id}
              title={`${p.firstName} ${p.lastName}`.trim()}
              subtitle={p.description || undefined}
              badges={
                p.roles.length > 0 ? (
                  <>
                    {p.roles.map((r) => (
                      <StatusBadge
                        key={r}
                        label={roleBadgeLabel(p, r)}
                        variant={r === 'custom' ? 'outline' : 'secondary'}
                      />
                    ))}
                  </>
                ) : (
                  <span className="text-xs text-muted-foreground">بدون نقش</span>
                )
              }
              meta={
                <>
                  {p.company && <span>{p.company}</span>}
                  {p.city && <span>{p.city}</span>}
                  {p.phone && <span>تلفن: {toFa(p.phone)}</span>}
                </>
              }
              onClick={() => openEdit(p)}
              trailing={
                <DropdownMenu dir="rtl">
                  <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                    <Button variant="ghost" size="icon" className="size-11" aria-label={`گزینه‌های ${p.firstName} ${p.lastName}`}>
                      <MoreVertical className="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                    <DropdownMenuItem onClick={() => openEdit(p)}>
                      <Pencil className="size-4" />
                      ویرایش
                    </DropdownMenuItem>
                    <DropdownMenuItem variant="destructive" onClick={() => setDeleteId(p.id)}>
                      <Trash2 className="size-4" />
                      حذف
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              }
            />
          ))}
        </div>
      )}

      {/* فرم ثبت/ویرایش */}
      <ProfileFormDialog
        open={formOpen}
        editing={editing}
        onClose={() => {
          setFormOpen(false)
          setEditing(null)
        }}
        onCreated={(rec) => {
          setEditing(rec)
          toast.success(messages.saved)
        }}
      />

      {/* تأیید حذف — حذف ایمن: سوابق اسنپ‌شده حفظ می‌شوند */}
      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(o) => {
          if (!o) setDeleteId(null)
        }}
        title="حذف پروفایل"
        description={`${deleteTarget ? `پروفایل «${`${deleteTarget.firstName} ${deleteTarget.lastName}`.trim()}» حذف می‌شود. ` : ''}سوابق ثبت‌شده با نام لحظه ثبت حفظ می‌شود و تغییری نمی‌کند. این عمل بازگشت‌پذیر نیست.`}
        confirmLabel="حذف"
        destructive
        loading={deleting}
        onConfirm={handleDelete}
      />
    </div>
  )
}

// ================= فرم ثبت/ویرایش پروفایل =================

function ProfileFormDialog({
  open,
  editing,
  onClose,
  onCreated,
}: {
  open: boolean
  editing: Profile | null
  onClose: () => void
  onCreated: (rec: Profile) => void
}) {
  const [values, setValues] = React.useState<ProfileFormValues>(defaultProfileValues)
  const [errors, setErrors] = React.useState<ProfileFormErrors>({})
  const [saving, setSaving] = React.useState(false)

  React.useEffect(() => {
    if (!open) return
    setErrors({})
    setValues(editing ? profileValuesFromRecord(editing) : defaultProfileValues())
  }, [open, editing])

  const setField = <K extends keyof ProfileFormValues>(key: K, v: ProfileFormValues[K]) => {
    setValues((f) => ({ ...f, [key]: v }))
    setErrors((e) => ({ ...e, [key]: undefined }))
  }

  const toggleRole = (role: ProfileRole) => {
    setValues((f) => ({
      ...f,
      roles: f.roles.includes(role) ? f.roles.filter((r) => r !== role) : [...f.roles, role],
    }))
  }

  const hasContractor = values.roles.includes('contractor')
  const hasFusion = values.roles.includes('fusion_tech')
  const hasTest = values.roles.includes('test_tech')
  const hasDrop = values.roles.includes('drop_executor')
  const hasRoleFields = hasContractor || hasFusion || hasTest || hasDrop

  const handleSave = async () => {
    const errs: ProfileFormErrors = {}
    if (!values.firstName.trim()) errs.firstName = 'نام الزامی است'
    if (!values.lastName.trim()) errs.lastName = 'نام خانوادگی الزامی است'
    if (values.roles.includes('custom') && !values.customRoleLabel.trim()) {
      errs.customRoleLabel = 'عنوان نقش سفارشی الزامی است'
    }
    if (Object.values(errs).some(Boolean)) {
      setErrors(errs)
      toast.error(Object.values(errs).find(Boolean) || messages.requiredMissing)
      return
    }

    const payload: ProfileInput = {
      firstName: values.firstName.trim(),
      lastName: values.lastName.trim(),
      phone: values.phone.trim(),
      company: values.company.trim(),
      city: values.city.trim(),
      description: values.description.trim(),
      roles: [...values.roles],
      customRoleLabel: values.roles.includes('custom') ? values.customRoleLabel.trim() : '',
      roleData: {
        contractorArea: values.contractorArea.trim() || undefined,
        fusionDevice: values.fusionDevice.trim() || undefined,
        testDevice: values.testDevice.trim() || undefined,
        dropCableType: values.dropCableType.trim() || undefined,
        dropMethod: values.dropMethod.trim() || undefined,
      },
    }

    setSaving(true)
    try {
      if (editing) {
        await updateProfile(editing.id, payload)
        toast.success(messages.updated)
        onClose()
      } else {
        const rec = await createProfile(payload)
        onCreated(rec)
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
          <DialogTitle className="text-base">{editing ? 'ویرایش پروفایل' : 'افزودن پروفایل'}</DialogTitle>
          <DialogDescription className="text-xs">
            مشخصات فرد، نقش‌ها و تجهیزات کاری را وارد کنید
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3 overflow-y-auto p-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="نام" required error={errors.firstName}>
              <Input
                value={values.firstName}
                onChange={(e) => setField('firstName', e.target.value)}
                placeholder="مثلاً: علی"
                className="min-h-11"
              />
            </Field>

            <Field label="نام خانوادگی" required error={errors.lastName}>
              <Input
                value={values.lastName}
                onChange={(e) => setField('lastName', e.target.value)}
                placeholder="مثلاً: محمدی"
                className="min-h-11"
              />
            </Field>

            <Field label="شماره تماس">
              <Input
                value={values.phone}
                onChange={(e) => setField('phone', e.target.value)}
                placeholder="اختیاری"
                inputMode="tel"
                className="min-h-11"
                dir="ltr"
              />
            </Field>

            <Field label="شهر">
              <Input
                value={values.city}
                onChange={(e) => setField('city', e.target.value)}
                placeholder="اختیاری"
                className="min-h-11"
              />
            </Field>

            <Field label="شرکت/مجموعه" className="sm:col-span-2">
              <Input
                value={values.company}
                onChange={(e) => setField('company', e.target.value)}
                placeholder="اختیاری"
                className="min-h-11"
              />
            </Field>
          </div>

          <div className="flex flex-col gap-2">
            <div>
              <h3 className="text-sm font-semibold">نقش‌ها</h3>
              <p className="mt-0.5 text-xs text-muted-foreground">می‌توانید چند نقش را همزمان انتخاب کنید</p>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3" role="group" aria-label="انتخاب نقش‌ها">
              {ALL_ROLES.map((role) => {
                const selected = values.roles.includes(role)
                return (
                  <label
                    key={role}
                    className={cn(
                      'flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border p-3 text-sm transition-colors',
                      selected && 'border-primary bg-primary/5 font-medium'
                    )}
                  >
                    <Checkbox
                      checked={selected}
                      onCheckedChange={() => toggleRole(role)}
                      aria-label={profileRoleLabels[role]}
                    />
                    <span className="leading-5">{profileRoleLabels[role]}</span>
                  </label>
                )
              })}
            </div>
          </div>

          {values.roles.includes('custom') && (
            <Field label="عنوان نقش سفارشی" required error={errors.customRoleLabel}>
              <Input
                value={values.customRoleLabel}
                onChange={(e) => setField('customRoleLabel', e.target.value)}
                placeholder="مثلاً: مسئول آسانسور شبکه"
                className="min-h-11"
              />
            </Field>
          )}

          {hasRoleFields && (
            <div className="grid grid-cols-1 gap-3 rounded-xl border p-3 sm:grid-cols-2">
              <h3 className="text-sm font-semibold sm:col-span-2">مشخصات بر اساس نقش</h3>
              {hasContractor && (
                <Field label="محدوده فعالیت">
                  <Input
                    value={values.contractorArea}
                    onChange={(e) => setField('contractorArea', e.target.value)}
                    placeholder="مثلاً: شمال شهر"
                    className="min-h-11"
                  />
                </Field>
              )}
              {hasFusion && (
                <Field label="مدل دستگاه فیوژن">
                  <Input
                    value={values.fusionDevice}
                    onChange={(e) => setField('fusionDevice', e.target.value)}
                    placeholder="مثلاً: Sumitomo T-72C"
                    className="min-h-11"
                    dir="ltr"
                  />
                </Field>
              )}
              {hasTest && (
                <Field label="دستگاه اندازه‌گیری">
                  <Input
                    value={values.testDevice}
                    onChange={(e) => setField('testDevice', e.target.value)}
                    placeholder="مثلاً: Power Meter PM-50"
                    className="min-h-11"
                    dir="ltr"
                  />
                </Field>
              )}
              {hasDrop && (
                <>
                  <Field label="نوع کابل دراپ">
                    <Input
                      value={values.dropCableType}
                      onChange={(e) => setField('dropCableType', e.target.value)}
                      placeholder="مثلاً: دراپ ۲ کور"
                      className="min-h-11"
                    />
                  </Field>
                  <Field label="روش اجرا">
                    <Input
                      value={values.dropMethod}
                      onChange={(e) => setField('dropMethod', e.target.value)}
                      placeholder="مثلاً: هوایی"
                      className="min-h-11"
                    />
                  </Field>
                </>
              )}
            </div>
          )}

          <Field label="توضیحات">
            <Textarea
              value={values.description}
              onChange={(e) => setField('description', e.target.value)}
              rows={3}
              placeholder="اختیاری"
            />
          </Field>
        </div>

        <DialogFooter className="flex-row justify-start gap-2 border-t p-4">
          <Button onClick={handleSave} disabled={saving} className="min-h-11 flex-1">
            {saving ? 'در حال ذخیره…' : 'ذخیره'}
          </Button>
          <Button variant="outline" onClick={onClose} disabled={saving} className="min-h-11 flex-1">
            انصراف
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
