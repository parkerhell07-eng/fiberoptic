// فایبرکار — خروجی CSV (سازگار با Excel فارسی: BOM + CRLF + نقل‌قول استاندارد)
// هیچ داده‌ای از این برنامه جعل نمی‌شود؛ مقادیر فقط از رکوردهای واقعی IndexedDB می‌آیند.
import { db } from './localdb'
import { adaptiveNum, computeConsumed, formatJalali, toFa } from './persian'
import {
  consumableCategoryLabels,
  consumableUnitLabels,
  deliveryStatusLabels,
  installMethodLabels,
  installStatusLabels,
  operationStatusLabels,
  operationTypeLabels,
} from './labels'
import type { Box, ConsumableUsage, DropCable, Operation, PowerTest, Project, Route } from './types'

/**
 * ساخت متن CSV:
 * - ارسال با CRLF (استاندارد RFC 4180)
 * - فیلدهای حاوی ویرگول/گیومه/خط جدید داخل گیومه و گیومه‌ها دوتایی می‌شوند
 * - پیشوند BOM (\uFEFF) برای نمایش درست فارسی در Excel
 */
export function toCsv(headers: string[], rows: string[][]): string {
  const esc = (v: string): string => {
    const s = String(v ?? '')
    return /["\r\n,]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const lines = [headers, ...rows].map((r) => r.map(esc).join(','))
  return '\uFEFF' + lines.join('\r\n')
}

function csvBlob(text: string): Blob {
  return new Blob([text], { type: 'text/csv;charset=utf-8' })
}

/** نقشه نام پروژه/مسیر/باکس برای ستون‌های والد (یک بار برای هر خروجی) */
async function loadLookups(): Promise<{
  projects: Map<string, string>
  routes: Map<string, string>
  boxes: Map<string, string>
}> {
  const [projects, routes, boxes] = await Promise.all([
    db.projects.toArray(),
    db.routes.toArray(),
    db.boxes.toArray(),
  ])
  return {
    projects: new Map(projects.map((p: Project) => [p.id, p.name || p.code || '—'])),
    routes: new Map(routes.map((r: Route) => [r.id, r.name || r.code || '—'])),
    boxes: new Map(boxes.map((b: Box) => [b.id, b.number || '—'])),
  }
}

function statusFa(map: Record<string, string>, key: string): string {
  return map[key] ?? 'نامشخص'
}

// ================= عملیات =================

export async function exportOperationsCsv(projectId?: string): Promise<Blob> {
  const [ops, lookups] = await Promise.all([
    projectId ? db.operations.where('projectId').equals(projectId).toArray() : db.operations.toArray(),
    loadLookups(),
  ])
  const rows = ops
    .sort((a, b) => a.createdAt - b.createdAt)
    .map((o: Operation) => [
      o.title || 'بدون عنوان',
      o.type === 'custom' && o.customTypeLabel ? o.customTypeLabel : statusFa(operationTypeLabels, o.type),
      formatJalali(o.date),
      statusFa(operationStatusLabels, o.status),
      o.projectId ? (lookups.projects.get(o.projectId) ?? '—') : '—',
      o.routeId ? (lookups.routes.get(o.routeId) ?? '—') : '—',
      o.boxId ? (lookups.boxes.get(o.boxId) ?? '—') : '—',
      o.assigneeName || '—',
      o.assigneeRole || '—',
      o.techSpecs || '—',
      o.description || '—',
      formatJalali(o.createdAt),
    ])
  const headers = [
    'عنوان',
    'نوع عملیات',
    'تاریخ',
    'وضعیت',
    'پروژه',
    'مسیر',
    'باکس',
    'مسئول',
    'نقش مسئول',
    'مشخصات فنی',
    'توضیحات',
    'تاریخ ثبت',
  ]
  return csvBlob(toCsv(headers, rows))
}

// ================= دراپ‌کابل =================

export async function exportDropCablesCsv(projectId?: string): Promise<Blob> {
  const [cables, lookups] = await Promise.all([
    projectId ? db.dropCables.where('projectId').equals(projectId).toArray() : db.dropCables.toArray(),
    loadLookups(),
  ])
  const rows = cables
    .sort((a, b) => a.createdAt - b.createdAt)
    .map((c: DropCable) => {
      const consumed = computeConsumed(c.initialMeters, c.returnedMeters, c.consumedUser)
      const consumedText =
        consumed.valid && consumed.value !== undefined ? adaptiveNum(consumed.value) : '—'
      const sourceText =
        consumed.source === 'user' ? 'کاربر' : consumed.source === 'auto' ? 'محاسباتی' : '—'
      return [
        c.destination || '—',
        c.serviceId || '—',
        c.address || '—',
        formatJalali(c.date),
        c.executorName || '—',
        c.cableType || '—',
        c.brand || '—',
        c.model || '—',
        c.coreCount !== undefined ? toFa(c.coreCount) : '—',
        c.initialMeters !== undefined ? toFa(c.initialMeters) : '—',
        c.returnedMeters !== undefined ? toFa(c.returnedMeters) : '—',
        consumedText,
        sourceText,
        c.installMethod === 'custom' && c.customMethodLabel
          ? c.customMethodLabel
          : statusFa(installMethodLabels, c.installMethod),
        statusFa(installStatusLabels, c.installStatus),
        statusFa(deliveryStatusLabels, c.deliveryStatus),
        c.projectId ? (lookups.projects.get(c.projectId) ?? '—') : '—',
        c.routeId ? (lookups.routes.get(c.routeId) ?? '—') : '—',
        c.sourceBoxId ? (lookups.boxes.get(c.sourceBoxId) ?? '—') : '—',
        c.description || '—',
      ]
    })
  const headers = [
    'مقصد',
    'شناسه سرویس',
    'آدرس',
    'تاریخ',
    'مجری',
    'نوع کابل',
    'برند',
    'مدل',
    'تعداد کور',
    'متراژ اولیه (متر)',
    'متراژ برگشتی (متر)',
    'متراژ مصرفی (متر)',
    'منبع متراژ',
    'روش اجرا',
    'وضعیت نصب',
    'وضعیت تحویل',
    'پروژه',
    'مسیر',
    'باکس مبدأ',
    'توضیحات',
  ]
  return csvBlob(toCsv(headers, rows))
}

// ================= تست توان =================

/** مقدار تبدیل‌شده با برچسب «محاسباتی» — مقدار ثبت‌شده دست‌نخورده می‌ماند */
function convertedText(value: number, unit: 'dBm' | 'mW'): string {
  const raw = unit === 'dBm' ? Math.pow(10, value / 10) : 10 * Math.log10(value)
  if (!Number.isFinite(raw)) return '—'
  return `${adaptiveNum(raw)} ${unit === 'dBm' ? 'mW' : 'dBm'} (محاسباتی)`
}

export async function exportPowerTestsCsv(projectId?: string): Promise<Blob> {
  const [tests, lookups] = await Promise.all([
    projectId ? db.powerTests.where('projectId').equals(projectId).toArray() : db.powerTests.toArray(),
    loadLookups(),
  ])
  const rows = tests
    .sort((a, b) => a.createdAt - b.createdAt)
    .map((t: PowerTest) => [
      t.location || '—',
      formatJalali(t.date),
      toFa(t.value),
      t.unit,
      convertedText(t.value, t.unit),
      t.wavelengthNm !== undefined ? `${toFa(t.wavelengthNm)} nm` : '—',
      t.deviceModel || '—',
      t.assigneeName || '—',
      t.projectId ? (lookups.projects.get(t.projectId) ?? '—') : '—',
      t.routeId ? (lookups.routes.get(t.routeId) ?? '—') : '—',
      t.boxId ? (lookups.boxes.get(t.boxId) ?? '—') : '—',
      t.description || '—',
    ])
  const headers = [
    'محل تست',
    'تاریخ',
    'مقدار اندازه‌گیری‌شده',
    'واحد',
    'معادل محاسباتی',
    'طول موج',
    'مدل دستگاه',
    'مسئول',
    'پروژه',
    'مسیر',
    'باکس',
    'توضیحات',
  ]
  return csvBlob(toCsv(headers, rows))
}

// ================= لوازم مصرفی (ثبت‌های مصرف) =================

export async function exportConsumablesCsv(projectId?: string): Promise<Blob> {
  const [usages, items, lookups] = await Promise.all([
    projectId ? db.consumableUsages.where('projectId').equals(projectId).toArray() : db.consumableUsages.toArray(),
    db.consumableItems.toArray(),
    loadLookups(),
  ])
  const itemById = new Map(items.map((i) => [i.id, i]))
  const rows = usages
    .sort((a, b) => a.createdAt - b.createdAt)
    .map((u: ConsumableUsage) => {
      const item = itemById.get(u.itemId)
      return [
        item?.name ?? 'قلم حذف‌شده',
        item ? statusFa(consumableCategoryLabels, item.category) : '—',
        item ? statusFa(consumableUnitLabels, item.unit) : '—',
        adaptiveNum(u.quantity),
        formatJalali(u.date),
        u.projectId ? (lookups.projects.get(u.projectId) ?? '—') : '—',
        u.routeId ? (lookups.routes.get(u.routeId) ?? '—') : '—',
        u.boxId ? (lookups.boxes.get(u.boxId) ?? '—') : '—',
        u.note || '—',
        formatJalali(u.createdAt),
      ]
    })
  const headers = [
    'قلم',
    'دسته',
    'واحد',
    'مقدار مصرف',
    'تاریخ',
    'پروژه',
    'مسیر',
    'باکس',
    'توضیحات',
    'تاریخ ثبت',
  ]
  return csvBlob(toCsv(headers, rows))
}

// چهار خروجی: operations / drop-cables / power-tests / consumables
export type CsvKind = 'operations' | 'drop-cables' | 'power-tests' | 'consumables'
