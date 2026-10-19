// فایبرکار — ابزارهای فارسی: تاریخ شمسی، اعداد، تبدیل واحد توان
import { toJalaali, toGregorian, jalaaliMonthLength as jalaaliMonthLengthOf } from 'jalaali-js'

export const faDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹']

/** تبدیل ارقام لاتین به فارسی */
export function toFa(input: string | number | undefined | null): string {
  if (input === undefined || input === null) return ''
  return String(input).replace(/\d/g, (d) => faDigits[Number(d)])
}

/** تبدیل ارقام فارسی/عربی به لاتین (برای ورودی‌های عددی) */
export function toEnDigits(input: string): string {
  return input
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
}

/** قالب‌بندی عدد با ارقام فارسی و جداکننده هزارگان */
export function formatNum(n: number | undefined | null, fractionDigits = 0): string {
  if (n === undefined || n === null || Number.isNaN(n)) return '—'
  const fixed = Number(n.toFixed(fractionDigits))
  const [intPart, fracPart] = String(fixed).split('.')
  const withSep = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '٬')
  return toFa(fracPart ? `${withSep}.${fracPart}` : withSep)
}

/** قالب‌بندی متراژ */
export function formatMeters(n: number | undefined | null): string {
  if (n === undefined || n === null || Number.isNaN(n)) return '—'
  const digits = Number.isInteger(n) ? 0 : 1
  return `${formatNum(n, digits)} متر`
}

/** قالب‌بندی حجم فایل */
export function formatBytes(bytes: number): string {
  if (!bytes || bytes < 0) return toFa(0) + ' بایت'
  const units = ['بایت', 'کیلوبایت', 'مگابایت', 'گیگابایت']
  let i = 0
  let v = bytes
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024
    i++
  }
  return `${formatNum(v, v < 10 && i > 0 ? 1 : 0)} ${units[i]}`
}

// ================= تاریخ شمسی =================

export const jalaliMonthNames = [
  'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور',
  'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند',
]

export const jalaliWeekdayNames = ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه']

/** تاریخ امروز به‌صورت ISO میلادی 'YYYY-MM-DD' (بر اساس ساعت محلی) */
export function todayISO(): string {
  const d = new Date()
  const p = (x: number) => String(x).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

/** ISO 'YYYY-MM-DD' یا epoch ms → اجزای شمسی */
export function isoToJalali(iso: string | number | undefined | null): { jy: number; jm: number; jd: number } | null {
  if (!iso) return null
  let d: Date
  if (typeof iso === 'number') d = new Date(iso)
  else {
    const parts = iso.split('-').map(Number)
    if (parts.length !== 3 || parts.some(Number.isNaN)) return null
    d = new Date(parts[0], parts[1] - 1, parts[2])
  }
  if (Number.isNaN(d.getTime())) return null
  return toJalaali(d.getFullYear(), d.getMonth() + 1, d.getDate())
}

/** ISO → '۱۴۰۳/۰۸/۱۲' */
export function formatJalali(iso: string | number | undefined | null, withWeekday = false): string {
  const j = isoToJalali(iso)
  if (!j) return '—'
  const base = `${toFa(j.jy)}/${toFa(String(j.jm).padStart(2, '0'))}/${toFa(String(j.jd).padStart(2, '0'))}`
  if (!withWeekday) return base
  const g = toGregorian(j.jy, j.jm, j.jd)
  const d = new Date(g.gy, g.gm - 1, g.gd)
  return `${jalaliWeekdayNames[(d.getDay() + 1) % 7]} ${base}`
}

/** epoch ms → '۱۴۰۳/۰۸/۱۲ - ۱۴:۳۰' */
export function formatJalaliDateTime(ms: number | undefined | null): string {
  if (!ms) return '—'
  const d = new Date(ms)
  const p = (x: number) => toFa(String(x).padStart(2, '0'))
  return `${formatJalali(ms)} - ${p(d.getHours())}:${p(d.getMinutes())}`
}

/** شمسی → ISO میلادی */
export function jalaliToISO(jy: number, jm: number, jd: number): string {
  const g = toGregorian(jy, jm, jd)
  const p = (x: number) => String(x).padStart(2, '0')
  return `${g.gy}-${p(g.gm)}-${p(g.gd)}`
}

export function jalaliMonthLength(jy: number, jm: number): number {
  return jalaaliMonthLengthOf(jy, jm)
}

/** دامنه سال‌های قابل انتخاب برای پیکر */
export function jalaliYearRange(): number[] {
  const current = isoToJalali(todayISO())?.jy ?? 1404
  const out: number[] = []
  for (let y = current - 15; y <= current + 2; y++) out.push(y)
  return out
}

/** بررسی معتبر بودن رشته تاریخ ISO */
export function isValidISODate(iso: string | undefined | null): iso is string {
  return !!iso && /^\d{4}-\d{2}-\d{2}$/.test(iso) && !Number.isNaN(new Date(iso).getTime())
}

// ================= تبدیل واحد توان (فرمول صحیح فیزیکی) =================

/** mW → dBm : P(dBm) = 10 × log10(P(mW) / 1mW) */
export function mwToDbm(mw: number): number {
  return 10 * Math.log10(mw)
}

/** dBm → mW : P(mW) = 10^(P(dBm)/10) */
export function dbmToMw(dbm: number): number {
  return Math.pow(10, dbm / 10)
}

/**
 * مقدار تبدیل‌شده برای نمایش (بدون تغییر مقدار ثبت‌شده کاربر).
 * خروجی همیشه با برچسب «محاسباتی» نمایش داده شود.
 */
export function convertedPower(value: number, unit: 'dBm' | 'mW'): { text: string; targetUnit: string } | null {
  if (!Number.isFinite(value)) return null
  if (unit === 'dBm') {
    const mw = dbmToMw(value)
    return { text: formatNum(mw, mw < 0.01 ? 6 : mw < 1 ? 4 : 3), targetUnit: 'mW' }
  }
  const dbm = mwToDbm(value)
  if (!Number.isFinite(dbm)) return null
  return { text: formatNum(dbm, 2), targetUnit: 'dBm' }
}

// ================= اعتبارسنجی متراژ دراپ‌کابل =================

/**
 * محاسبه متراژ مصرفی — فقط وقتی اطلاعات کافی و معتبر باشد.
 * - مقدار واردشده توسط کاربر (consumedUser) هرگز تغییر نمی‌کند.
 * - مقدار محاسباتی (auto) فقط از طول اولیه و برگشتی معتبر به دست می‌آید.
 */
export function computeConsumed(
  initial: number | undefined,
  returned: number | undefined,
  user: number | undefined
): { value?: number; source: 'auto' | 'user' | 'none'; valid: boolean; message?: string } {
  if (user !== undefined && user !== null && Number.isFinite(user)) {
    if (user < 0) return { source: 'none', valid: false, message: 'متراژ مصرفی منفی پذیرفته نیست' }
    return { value: user, source: 'user', valid: true }
  }
  if (initial !== undefined && initial !== null && Number.isFinite(initial) && initial >= 0) {
    if (returned !== undefined && returned !== null && Number.isFinite(returned) && returned >= 0) {
      if (returned > initial) {
        return { source: 'none', valid: false, message: 'متراژ برگشتی نمی‌تواند بیشتر از متراژ اولیه باشد' }
      }
      return { value: initial - returned, source: 'auto', valid: true }
    }
    return { source: 'none', valid: false, message: 'برای محاسبه، متراژ برگشتی لازم است' }
  }
  return { source: 'none', valid: false, message: 'اطلاعات کافی برای محاسبه موجود نیست' }
}

/** اعتبارسنجی متراژ: بدون مقدار منفی */
export function validateMeterage(value: number | undefined, label = 'متراژ'): string | null {
  if (value === undefined || value === null || value === 0) return null // اختیاری
  if (!Number.isFinite(value)) return `${label} واردشده معتبر نیست`
  if (value < 0) return `${label} منفی پذیرفته نیست`
  return null
}

/** پارس عدد از ورودی (با پشتیبانی ارقام فارسی) */
export function parseNumberInput(input: string): number | undefined {
  const en = toEnDigits(String(input)).replace(/[٬,\s]/g, '')
  if (en === '' || en === '-') return undefined
  const n = Number(en)
  return Number.isFinite(n) ? n : undefined
}
