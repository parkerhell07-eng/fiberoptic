'use client'

// فایبرکار — کامپوننت‌های مشترک UI (RTL، فارسی، لمس‌پذیر)
import * as React from 'react'
import { Calendar, ChevronRight, Plus, X } from 'lucide-react'
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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import {
  formatJalali,
  isoToJalali,
  jalaliMonthLength,
  jalaliMonthNames,
  jalaliToISO,
  jalaliYearRange,
  parseNumberInput,
  toEnDigits,
  toFa,
  todayISO,
} from '@/lib/persian'

// ================= هدر صفحه =================
export function PageHeader({
  title,
  subtitle,
  onBack,
  actions,
}: {
  title: string
  subtitle?: string
  onBack?: () => void
  actions?: React.ReactNode
}) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-3">
      {onBack && (
        <Button variant="outline" size="icon" onClick={onBack} aria-label="بازگشت" className="shrink-0">
          <ChevronRight className="size-5" />
        </Button>
      )}
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-xl font-bold sm:text-2xl">{title}</h1>
        {subtitle && <p className="mt-0.5 truncate text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  )
}

// ================= حالت خالی =================
export function EmptyState({
  icon,
  title,
  hint,
  actionLabel,
  onAction,
}: {
  icon?: React.ReactNode
  title: string
  hint?: string
  actionLabel?: string
  onAction?: () => void
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed py-12 px-4 text-center">
      {icon && <div className="text-muted-foreground/60">{icon}</div>}
      <div className="font-semibold">{title}</div>
      {hint && <div className="max-w-sm text-sm text-muted-foreground">{hint}</div>}
      {actionLabel && onAction && (
        <Button onClick={onAction} className="mt-2 min-h-11">
          <Plus className="size-4" />
          {actionLabel}
        </Button>
      )}
    </div>
  )
}

// ================= کارت آماری =================
export function StatCard({
  label,
  value,
  icon,
  onClick,
  tone = 'default',
}: {
  label: string
  value: React.ReactNode
  icon?: React.ReactNode
  onClick?: () => void
  tone?: 'default' | 'accent' | 'amber'
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={cn(
        'flex min-h-11 w-full flex-col items-start gap-1 rounded-xl border p-4 text-right transition-colors',
        onClick && 'hover:bg-accent/50 active:bg-accent cursor-pointer',
        tone === 'accent' && 'bg-primary/5 border-primary/20',
        tone === 'amber' && 'bg-amber-500/5 border-amber-500/20'
      )}
    >
      <div className="flex w-full items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">{label}</span>
        {icon && <span className="text-primary">{icon}</span>}
      </div>
      <span className="text-2xl font-bold tabular-nums">{value}</span>
    </button>
  )
}

// ================= بج وضعیت =================
export function StatusBadge({ label, variant }: { label: string; variant?: 'default' | 'secondary' | 'destructive' | 'outline' }) {
  return <Badge variant={variant ?? 'secondary'} className="shrink-0">{label || 'نامشخص'}</Badge>
}

// ================= دیالوگ تأیید =================
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'تأیید',
  destructive = false,
  loading = false,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  confirmLabel?: string
  destructive?: boolean
  loading?: boolean
  onConfirm: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm" dir="rtl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <DialogFooter className="flex-row justify-start gap-2">
          {/* در دیالوگ‌های مخرب، فوکوس اول روی «انصراف» است تا Enter/دکمه وسط گوشی حذف نکند */}
          {destructive ? (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading} className="min-h-11 flex-1" autoFocus>
                انصراف
              </Button>
              <Button variant="destructive" onClick={onConfirm} disabled={loading} className="min-h-11 flex-1">
                {loading ? 'در حال انجام…' : confirmLabel}
              </Button>
            </>
          ) : (
            <>
              <Button variant="default" onClick={onConfirm} disabled={loading} className="min-h-11 flex-1" autoFocus>
                {loading ? 'در حال انجام…' : confirmLabel}
              </Button>
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading} className="min-h-11 flex-1">
                انصراف
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ================= فیلد فرم =================
export function Field({
  label,
  required,
  hint,
  error,
  children,
  className,
}: {
  label: string
  required?: boolean
  hint?: string
  error?: string | null
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <Label className="text-sm">
        {label}
        {required && <span className="text-destructive"> *</span>}
      </Label>
      {children}
      {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
      {error && <p className="text-xs font-medium text-destructive">{error}</p>}
    </div>
  )
}

// ================= ورودی عددی (با پشتیبانی ارقام فارسی و ممیز «٫») =================
export function NumberField({
  value,
  onChange,
  placeholder,
  unit,
  disabled,
  className,
  id,
  allowNegative = true,
}: {
  value: number | undefined
  onChange: (v: number | undefined) => void
  placeholder?: string
  unit?: string
  disabled?: boolean
  className?: string
  id?: string
  /** پیش‌فرض true (مثل dBm منفی)؛ برای متراژها false بدهید */
  allowNegative?: boolean
}) {
  const [text, setText] = React.useState(value !== undefined ? String(value) : '')
  const lastEmitted = React.useRef<number | undefined>(value)
  const focused = React.useRef(false)

  // همگام‌سازی از بیرون فقط وقتی مقدار جدید از تایپ کاربر نیامده
  React.useEffect(() => {
    if (!focused.current && value !== lastEmitted.current) {
      setText(value !== undefined ? String(value) : '')
      lastEmitted.current = value
    }
  }, [value])

  const sanitize = (raw: string): string => {
    let t = toEnDigits(raw).replace(/٫/g, '.')
    if (!allowNegative) t = t.replace(/-/g, '')
    t = t.replace(/[^\d.-]/g, '')
    // فقط یک منفیِ ابتدای رشته
    if (allowNegative) {
      const neg = t.startsWith('-')
      t = t.replace(/-/g, '')
      if (neg) t = `-${t}`
    }
    // فقط یک ممیز
    const dot = t.indexOf('.')
    if (dot !== -1) t = t.slice(0, dot + 1) + t.slice(dot + 1).replace(/\./g, '')
    return t
  }

  return (
    <div className={cn('relative', className)}>
      <Input
        id={id}
        dir="ltr"
        inputMode="decimal"
        className="min-h-11 pl-14 text-left"
        value={text}
        disabled={disabled}
        placeholder={placeholder}
        onFocus={() => {
          focused.current = true
        }}
        onBlur={() => {
          focused.current = false
          // نرمال‌سازی نهایی پس از خروج از فیلد
          const n = text === '' || text === '-' || text === '.' ? undefined : Number(text)
          lastEmitted.current = Number.isFinite(n) ? n : undefined
          setText(lastEmitted.current !== undefined ? String(lastEmitted.current) : '')
          onChange(lastEmitted.current)
        }}
        onChange={(e) => {
          const t = sanitize(e.target.value)
          setText(t)
          if (t === '' || t === '-' || t === '.') {
            // تایپ میانی نامعتبر → فیلد پاک نمی‌شود؛ فقط خروجی undefined می‌ماند
            lastEmitted.current = undefined
            onChange(undefined)
            return
          }
          const n = Number(t)
          if (Number.isFinite(n)) {
            lastEmitted.current = n
            onChange(n)
          }
          // عدد نامعتبر میانی: آخرین مقدار معتبر حفظ می‌شود و متن دست‌نخورده می‌ماند
        }}
      />
      {unit && <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-xs text-muted-foreground">{unit}</span>}
    </div>
  )
}

// ================= انتخاب تاریخ شمسی =================
export function JalaliDatePicker({
  value,
  onChange,
  placeholder = 'انتخاب تاریخ',
  disabled,
  minIso,
  maxIso,
}: {
  value?: string // 'YYYY-MM-DD' میلادی
  onChange: (iso: string | undefined) => void
  placeholder?: string
  disabled?: boolean
  /** کمینه تاریخ مجاز (برای دامنه «از–تا») */
  minIso?: string
  /** بیشینه تاریخ مجاز */
  maxIso?: string
}) {
  const [open, setOpen] = React.useState(false)
  const initialJ = isoToJalali(value) ?? isoToJalali(todayISO())!
  const [viewYear, setViewYear] = React.useState(initialJ.jy)
  const [viewMonth, setViewMonth] = React.useState(initialJ.jm)

  React.useEffect(() => {
    if (open) {
      const j = isoToJalali(value) ?? isoToJalali(todayISO())!
      setViewYear(j.jy)
      setViewMonth(j.jm)
    }
  }, [open, value])

  const selected = value ? isoToJalali(value) : null
  const daysInMonth = jalaliMonthLength(viewYear, viewMonth)
  const g = jalaliToISO(viewYear, viewMonth, 1).split('-').map(Number)
  const firstWeekday = (new Date(g[0], g[1] - 1, g[2]).getDay() + 1) % 7 // شنبه = 0
  const todayJ = isoToJalali(todayISO())!
  const years = jalaliYearRange()

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn('min-h-11 w-full justify-between font-normal', !value && 'text-muted-foreground')}
        >
          <span>{value ? formatJalali(value) : placeholder}</span>
          <Calendar className="size-4 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-3" align="start" dir="rtl">
        <div className="mb-2 flex items-center gap-2">
          <select
            aria-label="ماه"
            className="h-9 flex-1 rounded-md border bg-background px-2 text-sm"
            value={viewMonth}
            onChange={(e) => setViewMonth(Number(e.target.value))}
          >
            {jalaliMonthNames.map((m, i) => (
              <option key={m} value={i + 1}>
                {m}
              </option>
            ))}
          </select>
          <select
            aria-label="سال"
            className="h-9 w-24 rounded-md border bg-background px-2 text-sm"
            value={viewYear}
            onChange={(e) => setViewYear(Number(e.target.value))}
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {toFa(y)}
              </option>
            ))}
          </select>
        </div>
        <div className="mb-1 grid grid-cols-7 gap-1 text-center text-[10px] text-muted-foreground">
          {['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'].map((d, i) => (
            <div key={i}>{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: firstWeekday }).map((_, i) => (
            <div key={`e-${i}`} />
          ))}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1
            const iso = jalaliToISO(viewYear, viewMonth, day)
            const outOfRange = (minIso !== undefined && iso < minIso) || (maxIso !== undefined && iso > maxIso)
            const isSelected = selected && selected.jy === viewYear && selected.jm === viewMonth && selected.jd === day
            const isToday = todayJ.jy === viewYear && todayJ.jm === viewMonth && todayJ.jd === day
            return (
              <button
                key={day}
                type="button"
                disabled={outOfRange}
                onClick={() => {
                  onChange(iso)
                  setOpen(false)
                }}
                className={cn(
                  'flex h-9 items-center justify-center rounded-md text-sm transition-colors',
                  isSelected ? 'bg-primary text-primary-foreground font-bold' : 'hover:bg-accent',
                  isToday && !isSelected && 'ring-1 ring-primary',
                  outOfRange && 'cursor-not-allowed opacity-30 hover:bg-transparent'
                )}
              >
                {toFa(day)}
              </button>
            )
          })}
        </div>
        <div className="mt-3 flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={() => {
              const today = todayISO()
              // «امروز» هم در محدوده مجاز clamp می‌شود
              const clamped = minIso && today < minIso ? minIso : maxIso && today > maxIso ? maxIso : today
              onChange(clamped)
              setOpen(false)
            }}
          >
            امروز
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="flex-1"
            onClick={() => {
              onChange(undefined)
              setOpen(false)
            }}
          >
            <X className="size-4" />
            پاک کردن
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}

// ================= تب‌های سگمنتی =================
export function SegmentedTabs({
  options,
  value,
  onChange,
  className,
}: {
  options: Array<{ value: string; label: string }>
  value: string
  onChange: (v: string) => void
  className?: string
}) {
  return (
    <div className={cn('flex gap-1 overflow-x-auto rounded-lg bg-muted p-1', className)} role="tablist">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="tab"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            'min-h-9 shrink-0 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
            value === o.value ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

// ================= کارت آیتم کلی =================
export function ItemCard({
  title,
  subtitle,
  meta,
  badges,
  onClick,
  trailing,
  thumb,
}: {
  title: React.ReactNode
  subtitle?: React.ReactNode
  meta?: React.ReactNode
  badges?: React.ReactNode
  onClick?: () => void
  trailing?: React.ReactNode
  thumb?: React.ReactNode
}) {
  return (
    <div
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={(e) => {
        if (onClick && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault()
          onClick()
        }
      }}
      className={cn(
        'flex items-center gap-3 rounded-xl border bg-card p-4 transition-colors',
        onClick && 'cursor-pointer hover:bg-accent/50 active:bg-accent'
      )}
    >
      {thumb}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate font-semibold">{title}</span>
          {badges}
        </div>
        {subtitle && <div className="mt-1 truncate text-sm text-muted-foreground">{subtitle}</div>}
        {meta && <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">{meta}</div>}
      </div>
      {trailing && <div className="shrink-0">{trailing}</div>}
    </div>
  )
}

// ================= ردیف اطلاعات =================
export function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b py-2 last:border-b-0">
      <span className="shrink-0 text-sm text-muted-foreground">{label}</span>
      <span className="text-left text-sm font-medium">{value}</span>
    </div>
  )
}

// ================= انتخابگر مرتب‌سازی =================
export function SortSelect({
  value,
  onChange,
  options,
}: {
  value: string
  onChange: (v: string) => void
  options: Array<{ value: string; label: string }>
}) {
  return (
    <select
      aria-label="مرتب‌سازی"
      className="h-11 rounded-md border bg-background px-3 text-sm"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  )
}
