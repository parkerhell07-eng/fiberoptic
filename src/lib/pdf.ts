// فایبرکار — تولید گزارش PDF فارسی و راست‌چین
// روش: رندر HTML در مرورگر (اتصال صحیح حروف فارسی) → html2canvas-pro → jsPDF
//
// ⚠️ هشدار طراحی (هرگز نقض نشود):
// تمام نودهای DOMِ «گزارش» باید فقط استایل INLINE با رنگ HEX داشته باشند
// (الگوی C = {...} و base = '...' در پایین فایل). هرگز کلاس Tailwind یا
// متغیر CSS (رنگ oklch) روی نودهای گزارش استفاده نشود — html2canvas-pro
// روی oklch خطای parse می‌دهد و رندر سیاه/خراب می‌شود.
//
// معماری صفحه‌بندی:
//  - هر جدول به «سرستون + ردیف‌های مستقل» شکسته می‌شود (بلوک به بلوک) تا
//    جدول‌های بلندتر از یک صفحه هرگز بریده نشوند؛ در شکستن صفحه، سرستونِ
//    همان جدول (tableId) دوباره در بالای صفحه جدید رندر می‌شود.
//  - در هر لحظه فقط «یک صفحه» در DOM سوار می‌شود (جلوگیری از OOM اندروید؛
//    html2canvas-pro کل سند را برای هر صفحه کلون می‌کند).
import { jsPDF } from 'jspdf'
import html2canvas from 'html2canvas-pro'
import type { Box, ConsumableUsage, DropCable, Fusion, Operation, Photo, PowerTest, Profile, Project, Route } from './types'
import { db, getPhotoBlob } from './localdb'
import {
  boxStatusLabels,
  boxTypeLabels,
  consumableUnitLabels,
  deliveryStatusLabels,
  installMethodLabels,
  installStatusLabels,
  operationStatusLabels,
  operationTypeLabels,
  photoCategoryLabels,
  powerUnitLabels,
  projectStatusLabels,
} from './labels'
import {
  adaptiveNum,
  computeConsumed,
  formatJalali,
  formatJalaliDateTime,
  formatMeters,
  formatNum,
  toFa,
} from './persian'
import { blobToReportDataUrl } from './images'
import { isNativeApp, nativeShareOrSaveFile, sanitizeFileName } from './native-bridge'

export interface ReportSections {
  info: boolean
  routes: boolean
  boxes: boolean
  operations: boolean
  fusions: boolean
  powerTests: boolean
  dropCables: boolean
  consumables: boolean
  photos: boolean
}

/** فازهای واقعی پیشرفت تولید گزارش */
export type ReportProgressPhase = 'photos' | 'measure' | 'pages'

export interface ReportProgress {
  phase: ReportProgressPhase
  done: number
  total: number
}

export interface ReportOptions {
  projectId: string
  mode: 'summary' | 'full'
  sections: ReportSections
  photoIds?: string[] // در صورت انتخاب، فقط این عکس‌ها
  onProgress?: (p: ReportProgress) => void
}

export interface GeneratedReport {
  blob: Blob
  pages: number
}

export const defaultSections: ReportSections = {
  info: true,
  routes: true,
  boxes: true,
  operations: true,
  fusions: true,
  powerTests: true,
  dropCables: true,
  consumables: true,
  photos: true,
}

// ---------- استایل‌های مشترک (فقط hex) ----------
const FONT = `var(--font-vazir), Vazirmatn, Tahoma, sans-serif`
const C = {
  text: '#1c2b26',
  sub: '#5b6f68',
  accent: '#047857',
  accentLight: '#ecfdf5',
  border: '#d7e3de',
  zebra: '#f6faf8',
  muted: '#8ba39a',
  amber: '#b45309',
  amberBg: '#fffbeb',
}

const base = `box-sizing:border-box;direction:rtl;font-family:${FONT};color:${C.text};`

function esc(s: string | undefined | null): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function dash(s: string | undefined | null): string {
  const v = String(s ?? '').trim()
  return v === '' ? '—' : esc(v)
}

// ---------- بلوک‌های محتوایی ----------
/**
 * بلوک = واحد صفحه‌بندی.
 *  - tableId: ردیف/سرستون یک جدول شکستنی — هنگام سرریز به صفحه جدید،
 *    سرستون همان tableId دوباره در بالای صفحه رندر می‌شود.
 *  - isTableHeader: این بلوک خودِ سرستون است (دوباره تکرار نمی‌شود).
 *  - keepWithNext: تیتر بخش/سرستون — تنها در انتهای صفحه رها نمی‌شود.
 */
interface Block {
  html: string
  tableId?: string
  isTableHeader?: boolean
  keepWithNext?: boolean
}

function sectionTitle(text: string, count?: number): Block {
  return {
    keepWithNext: true,
    html: `<div style="${base}display:flex;align-items:center;gap:8px;margin:18px 0 8px 0;">
      <div style="width:6px;height:20px;background:${C.accent};border-radius:3px;"></div>
      <div style="font-size:15px;font-weight:700;color:${C.accent};">${esc(text)}</div>
      ${count !== undefined ? `<div style="font-size:11px;color:${C.sub};background:${C.accentLight};border-radius:999px;padding:2px 10px;">${toFa(count)} مورد</div>` : ''}
    </div>`,
  }
}

/**
 * جدول کلید/مقدار شکستنی — هر ردیف یک بلوک مستقل (tableId مشترک) تا وقتی متن توضیحات/مشخصات
 * بلند می‌شود، جدول کل به صفحه بعد پرتاب نشود و فاصلهٔ بزرگ بین جدول‌ها نماند.
 * margin-top:-1px ردیف‌ها را به‌صورت جدول پیوسته نشان می‌دهد (همان الگوی جدول‌های داده).
 */
function kvTableBlocks(tableId: string, rows: Array<[string, string]>): Block[] {
  return rows.map(([k, v], i) => ({
    tableId,
    html: `<table style="${base}width:100%;table-layout:fixed;border-collapse:collapse;font-size:11.5px;${i > 0 ? 'margin-top:-1px;' : ''}">
      <tr style="background:${i % 2 ? C.zebra : '#ffffff'};">
        <td style="border:1px solid ${C.border};padding:6px 10px;font-weight:600;color:${C.sub};width:32%;overflow-wrap:anywhere;vertical-align:top;">${esc(k)}</td>
        <td style="border:1px solid ${C.border};padding:6px 10px;overflow-wrap:anywhere;vertical-align:top;">${v}</td>
      </tr>
    </table>`,
  }))
}

/** HTML سرستون جدول شکستنی (عرض‌ها درصدی؛ layout ثابت برای تراز ستون‌ها بین ردیف‌ها) */
function tableHeaderHtml(headers: string[], widths: number[]): string {
  return `<table style="${base}width:100%;table-layout:fixed;border-collapse:collapse;font-size:10.5px;">
    <tr>${headers
      .map(
        (h, i) =>
          `<th style="border:1px solid ${C.border};background:${C.accent};color:#ffffff;padding:6px 8px;font-weight:600;text-align:right;width:${widths[i] ?? 10}%;overflow-wrap:anywhere;">${esc(h)}</th>`
      )
      .join('')}</tr>
  </table>`
}

/** HTML یک ردیف جدول شکستنی — margin-top:-1px حاشیه ردیف قبلی را پوشش می‌دهد تا جدول پیوسته دیده شود */
function tableRowHtml(cells: string[], widths: number[], bg: string): string {
  return `<table style="${base}width:100%;table-layout:fixed;border-collapse:collapse;font-size:10.5px;margin-top:-1px;">
    <tr style="background:${bg};">${cells
      .map(
        (c, i) =>
          `<td style="border:1px solid ${C.border};padding:5px 8px;width:${widths[i] ?? 10}%;overflow-wrap:anywhere;">${c}</td>`
      )
      .join('')}</tr>
  </table>`
}

function paragraph(text: string): Block {
  return { html: `<div style="${base}font-size:11px;line-height:1.9;color:${C.text};white-space:pre-wrap;">${esc(text)}</div>` }
}

function note(text: string): Block {
  return {
    html: `<div style="${base}font-size:10px;color:${C.amber};background:${C.amberBg};border:1px solid #fde68a;border-radius:8px;padding:8px 12px;margin:6px 0;">${esc(text)}</div>`,
  }
}

function emptyHint(text: string): Block {
  return { html: `<div style="${base}font-size:11px;color:${C.muted};padding:6px 2px;">${esc(text)}</div>` }
}

/**
 * ردیف شبکهٔ عکس‌ها — هر ردیف یک بلوک اتمیک با ۲ عکس کنار هم، ارتفاع یکنواخت.
 * به‌جای object-fit (پشتیبانی نامطمئن در html2canvas) از max-width/max-height +
 * وسط‌چین flex استفاده می‌شود؛ عکس عمودی یا افقی هرگز کج/کشیده/بریده نمی‌شود.
 */
const GRID_IMG_H = 230
function photoGridRow(items: Array<{ title: string; caption: string; url: string }>): Block {
  const cell = (it: { title: string; caption: string; url: string }) => `
    <div style="display:flex;flex-direction:column;min-width:0;">
      <div style="font-size:10px;font-weight:600;color:${C.sub};margin-bottom:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(it.title)}</div>
      <div style="height:${GRID_IMG_H}px;display:flex;align-items:center;justify-content:center;background:#ffffff;border:1px solid ${C.border};border-radius:10px;overflow:hidden;">
        <img src="${it.url}" style="max-width:100%;max-height:100%;display:block;" />
      </div>
      ${it.caption ? `<div style="font-size:9.5px;color:${C.sub};margin-top:3px;line-height:1.6;max-height:3.2em;overflow:hidden;">${esc(it.caption)}</div>` : ''}
    </div>`
  return {
    html: `<div style="${base}display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:8px 0;">${items.map(cell).join('')}</div>`,
  }
}

function statsRow(items: Array<{ label: string; value: string }>): Block {
  return {
    html: `<div style="${base}display:flex;flex-wrap:wrap;gap:8px;margin:10px 0;">
      ${items
        .map(
          (it) => `<div style="flex:1;min-width:120px;background:${C.accentLight};border:1px solid ${C.border};border-radius:10px;padding:10px 12px;">
        <div style="font-size:10px;color:${C.sub};">${esc(it.label)}</div>
        <div style="font-size:15px;font-weight:700;color:${C.accent};margin-top:3px;">${it.value}</div>
      </div>`
        )
        .join('')}
    </div>`,
  }
}

/**
 * پاراگراف‌های بلند به تکه‌های کوچک شکسته می‌شوند (chunk=450) تا صفحه‌بندی متراکم بماند —
 * تکهٔ بلند اگر در فضای باقی‌ماندهٔ صفحه جا نشود کلش به صفحهٔ بعد می‌رود و حفرهٔ بزرگ می‌سازد.
 * اول بر خط‌های خودِ متن شکسته می‌شود (پرسه‌خط‌ها حفظ)، بعد خط‌های خیلی بلند بر مرز کلمه.
 */
function longParagraphs(text: string, chunk = 450): Block[] {
  const t = String(text ?? '').trim()
  if (!t) return []
  const out: Block[] = []
  const segments = t
    .split(/\n+/)
    .map((s) => s.trim())
    .filter(Boolean)
  for (const seg of segments) {
    if (seg.length <= chunk) {
      out.push(paragraph(seg))
      continue
    }
    const words = seg.split(/\s+/)
    let cur = ''
    for (const w of words) {
      if (cur && cur.length + 1 + w.length > chunk) {
        out.push(paragraph(cur))
        cur = w
      } else {
        cur = cur ? `${cur} ${w}` : w
      }
    }
    if (cur) out.push(paragraph(cur))
  }
  return out
}

// ---------- ساخت محتوا ----------
interface ReportData {
  project: Project
  routes: Route[]
  boxes: Box[]
  operations: Operation[]
  fusions: Fusion[]
  powerTests: PowerTest[]
  dropCables: DropCable[]
  photos: Photo[] // عکس‌های نهایی انتخاب‌شده برای درج
  allPhotosCount: number // کل عکس‌های پروژه (برای آمار واقعی)
  missingSelected: number // تعداد عکس‌های انتخابی که دیگر وجود ندارند
  profiles: Profile[]
  routeNameById: Map<string, string>
  boxLabelById: Map<string, string>
  consumableUsages: ConsumableUsage[] // ثبت‌های مصرف لینک‌شده به این پروژه (v1.3)
  consumableItemsById: Map<string, import('./types').ConsumableItem>
}

async function buildBlocks(
  opts: ReportOptions,
  data: ReportData
): Promise<{ blocks: Block[]; headerOf: Map<string, { block: Block; index: number }> }> {
  const { project, routes, boxes, operations, fusions, powerTests, dropCables, photos, allPhotosCount, missingSelected, profiles } = data
  const mode = opts.mode
  const full = mode === 'full'
  const blocks: Block[] = []
  const show = opts.sections
  const headerOf = new Map<string, { block: Block; index: number }>()

  // جدول شکستنی: سرستون + ردیف‌ها به‌صورت بلوک‌های مستقل (C1)
  const dataTableBlocks = (tableId: string, headers: string[], widths: number[], rows: string[][], zebra = true): void => {
    const header: Block = { html: tableHeaderHtml(headers, widths), tableId, isTableHeader: true, keepWithNext: true }
    headerOf.set(tableId, { block: header, index: blocks.length })
    blocks.push(header)
    rows.forEach((cells, i) => {
      blocks.push({ html: tableRowHtml(cells, widths, zebra && i % 2 ? C.zebra : '#ffffff'), tableId })
    })
  }

  // نام‌ها از Map — بدون find در هر ردیف (H3)
  const routeCell = (routeId?: string): string => (routeId ? dash(data.routeNameById.get(routeId)) : '—')
  const boxCell = (boxId?: string): string => (boxId ? dash(data.boxLabelById.get(boxId)) : '—')
  /** ستون ترکیبی «مسیر / باکس» برای فیوژن و تست توان */
  const ctxCell = (routeId?: string, boxId?: string): string => {
    const parts: string[] = []
    const rn = routeId ? data.routeNameById.get(routeId) : undefined
    const bn = boxId ? data.boxLabelById.get(boxId) : undefined
    if (rn && rn.trim() !== '') parts.push(esc(rn))
    if (bn && bn.trim() !== '') parts.push(esc(bn))
    return parts.length > 0 ? parts.join(' / ') : '—'
  }

  // سرصفحه گزارش
  blocks.push({
    html: `<div style="${base}text-align:center;margin-bottom:6px;">
      <div style="font-size:21px;font-weight:800;color:${C.accent};">گزارش پروژه ${esc(project.name)}</div>
      <div style="font-size:11px;color:${C.sub};margin-top:4px;">فیبرکار — گزارش رسمی پروژه شبکه فیبر نوری</div>
      <div style="font-size:10px;color:${C.muted};margin-top:2px;">تاریخ تولید: ${formatJalaliDateTime(Date.now())}</div>
    </div>
    <div style="${base}height:3px;background:linear-gradient(to left, ${C.accent}, #a7f3d0);border-radius:2px;margin-bottom:8px;"></div>`,
  })

  // مشخصات پروژه
  if (show.info) {
    const contractor = profiles.find((p) => p.id === project.contractorProfileId)
    const executor = profiles.find((p) => p.id === project.executorProfileId)
    blocks.push(sectionTitle('مشخصات پروژه'))
    const infoRows: Array<[string, string]> = [
      ['نام پروژه', dash(project.name)],
      ['کد پروژه', dash(project.code)],
      ['کارفرما', dash(project.client)],
      ['محدوده', dash(project.area)],
      ['وضعیت', projectStatusLabels[project.status]],
      ['تاریخ شروع', project.startDate ? formatJalali(project.startDate) : '—'],
    ]
    if (full) {
      if (contractor) infoRows.push(['پیمانکار', dash(`${contractor.firstName} ${contractor.lastName}`)])
      if (executor) infoRows.push(['مجری', dash(`${executor.firstName} ${executor.lastName}`)])
    }
    blocks.push(...kvTableBlocks('proj-info', infoRows))
    if (project.description) blocks.push(...longParagraphs(`توضیحات: ${project.description}`))

    blocks.push(
      statsRow([
        { label: 'مسیرها', value: toFa(routes.length) },
        { label: 'باکس‌ها', value: toFa(boxes.length) },
        { label: 'عملیات', value: toFa(operations.length) },
        { label: 'فیوژن‌ها', value: toFa(fusions.length) },
      ])
    )
    blocks.push(
      statsRow([
        { label: 'تست‌های توان', value: toFa(powerTests.length) },
        { label: 'دراپ‌کابل‌ها', value: toFa(dropCables.length) },
        {
          label: 'متراژ مصرفی کل',
          value: formatMeters(
            dropCables.reduce((s, c) => {
              const r = computeConsumed(c.initialMeters, c.returnedMeters, c.consumedUser)
              return s + (r.valid && r.value !== undefined ? r.value : 0)
            }, 0)
          ).replace(' متر', ''),
        },
        // آمار «عکس‌ها» همیشه کل عکس‌های پروژه است، نه فقط درج‌شده‌ها (M4)
        { label: 'عکس‌ها', value: toFa(allPhotosCount) },
      ])
    )
  }

  // مسیرها — در حالت خلاصه ستون «—» بدون داده حذف می‌شود (M3) — v1.3: مبدأ/مقصد/کابل/متراژ
  if (show.routes) {
    blocks.push(sectionTitle('مسیرهای شبکه', routes.length))
    if (routes.length === 0) {
      blocks.push(emptyHint('مسیری برای این پروژه ثبت نشده است.'))
    } else if (full) {
      dataTableBlocks(
        'routes',
        ['نام مسیر', 'کد', 'مبدأ → مقصد', 'کابل / فیبر', 'متراژ', 'توضیحات'],
        [18, 10, 20, 16, 10, 26],
        routes.map((r) => [
          dash(r.name),
          dash(r.code),
          dash([r.sourcePoint, r.destPoint].filter((x) => !!x?.trim()).join(' → ')),
          dash(
            [r.cableType, r.fiberCount !== undefined ? `${toFa(r.fiberCount)} کور` : null]
              .filter(Boolean)
              .join(' • ')
          ),
          r.lengthM !== undefined ? formatMeters(r.lengthM) : '—',
          dash(r.description),
        ])
      )
    } else {
      dataTableBlocks(
        'routes',
        ['نام مسیر', 'کد', 'متراژ'],
        [50, 26, 24],
        routes.map((r) => [dash(r.name), dash(r.code), r.lengthM !== undefined ? formatMeters(r.lengthM) : '—'])
      )
    }
  }

  // باکس‌ها — مرتب‌شده بر اساس مسیر و شماره طبیعی (H3)
  if (show.boxes) {
    blocks.push(sectionTitle('باکس‌ها', boxes.length))
    if (boxes.length === 0) {
      blocks.push(emptyHint('باکسی برای این پروژه ثبت نشده است.'))
    } else {
      if (full) {
        dataTableBlocks(
          'boxes',
          ['شماره باکس', 'مسیر', 'نوع', 'محل نصب', 'ظرفیت', 'برند / مدل', 'مشخصات کابل', 'وضعیت', 'توضیحات'],
          [9, 12, 11, 14, 8, 12, 16, 8, 10],
          boxes.map((b: Box) => [
            dash(b.number),
            routeCell(b.routeId),
            b.boxType === 'custom' && b.customBoxTypeLabel ? dash(b.customBoxTypeLabel) : b.boxType ? boxTypeLabels[b.boxType] : '—',
            dash(b.location),
            dash(b.capacity), // M5: ظرفیت
            dash([b.brand, b.model].filter((x) => !!x?.trim()).join(' ')),
            dash(b.cableSpec),
            boxStatusLabels[b.status],
            dash(b.description),
          ])
        )
      } else {
        dataTableBlocks(
          'boxes',
          ['شماره باکس', 'مسیر', 'محل نصب', 'مشخصات کابل', 'وضعیت'],
          [14, 20, 25, 25, 16],
          boxes.map((b: Box) => [
            dash(b.number),
            routeCell(b.routeId),
            dash(b.location),
            dash(b.cableSpec),
            boxStatusLabels[b.status],
          ])
        )
      }
    }
  }

  // عملیات — مرتب‌شده بر اساس زمان ثبت (H3)
  if (show.operations) {
    blocks.push(sectionTitle('عملیات اجرایی', operations.length))
    if (operations.length === 0) {
      blocks.push(emptyHint('عملیاتی ثبت نشده است.'))
    } else {
      if (full) {
        dataTableBlocks(
          'operations',
          ['عنوان', 'نوع', 'تاریخ', 'مسئول', 'نقش مسئول', 'وضعیت', 'توضیحات'],
          [20, 14, 12, 20, 13, 9, 12],
          operations.map((o: Operation) => [
            dash(o.title),
            o.type === 'custom' && o.customTypeLabel ? dash(o.customTypeLabel) : operationTypeLabels[o.type],
            formatJalali(o.date),
            dash(o.assigneeName),
            dash(o.assigneeRole), // M5: نقش مسئول
            operationStatusLabels[o.status],
            dash(o.description),
          ])
        )
      } else {
        dataTableBlocks(
          'operations',
          ['عنوان', 'نوع', 'تاریخ', 'مسئول', 'وضعیت'],
          [24, 17, 14, 27, 18],
          operations.map((o: Operation) => [
            dash(o.title),
            o.type === 'custom' && o.customTypeLabel ? dash(o.customTypeLabel) : operationTypeLabels[o.type],
            formatJalali(o.date),
            dash(o.assigneeName),
            operationStatusLabels[o.status],
          ])
        )
      }
      if (full)
        for (const o of operations) {
          if (o.techSpecs) blocks.push(...longParagraphs(`مشخصات فنی «${o.title}»: ${o.techSpecs}`))
        }
    }
  }

  // فیوژن‌ها — مرتب‌شده بر اساس زمان ثبت (H3)؛ حالت کامل: مسیر/باکس و توضیحات (M5)
  if (show.fusions) {
    blocks.push(sectionTitle('فیوژن', fusions.length))
    if (fusions.length === 0) {
      blocks.push(emptyHint('اتصال فیوژنی ثبت نشده است.'))
    } else if (full) {
      dataTableBlocks(
        'fusions',
        ['شناسه اتصال', 'مسیر / باکس', 'شماره تارها', 'تیوب', 'مشخصات کابل', 'دستگاه', 'نتیجه ثبت‌شده', 'توضیحات', 'تاریخ'],
        [13, 14, 10, 6, 13, 11, 15, 10, 8],
        fusions.map((f: Fusion) => [
          dash(f.connectionId),
          ctxCell(f.routeId, f.boxId),
          dash(f.fiberNumbers),
          dash(f.tubeNumber),
          dash(f.cableSpec),
          f.deviceModel ? dash(f.deviceModel) : '—',
          dash(f.result),
          dash(f.description),
          formatJalali(f.fusionDate),
        ])
      )
    } else {
      dataTableBlocks(
        'fusions',
        ['شناسه اتصال', 'شماره تارها', 'تیوب', 'مشخصات کابل', 'دستگاه', 'نتیجه ثبت‌شده', 'تاریخ'],
        [16, 12, 8, 18, 14, 20, 12],
        fusions.map((f: Fusion) => [
          dash(f.connectionId),
          dash(f.fiberNumbers),
          dash(f.tubeNumber),
          dash(f.cableSpec),
          f.deviceModel ? dash(f.deviceModel) : '—',
          dash(f.result),
          formatJalali(f.fusionDate),
        ])
      )
    }
    blocks.push(note('نتیجه فیوژن صرفاً همان مقداری است که در محل ثبت شده است؛ هیچ مقدار ساختگی درج نمی‌شود.'))
  }

  // تست توان — مرتب‌شده بر اساس زمان ثبت (H3)؛ mW با adaptiveNum تا مقدار کوچک فابسی نشود (H6)
  if (show.powerTests) {
    blocks.push(sectionTitle('تست توان', powerTests.length))
    const valueCell = (t: PowerTest): string => (t.unit === 'mW' ? adaptiveNum(t.value) : formatNum(t.value, 2))
    if (powerTests.length === 0) {
      blocks.push(emptyHint('تست توانی ثبت نشده است.'))
    } else if (full) {
      dataTableBlocks(
        'powerTests',
        ['محل تست', 'مسیر / باکس', 'مقدار ثبت‌شده', 'واحد', 'طول موج', 'دستگاه', 'مسئول', 'توضیحات', 'تاریخ'],
        [12, 12, 10, 12, 9, 13, 12, 11, 9],
        powerTests.map((t: PowerTest) => [
          dash(t.location),
          ctxCell(t.routeId, t.boxId),
          valueCell(t),
          powerUnitLabels[t.unit],
          t.wavelengthNm !== undefined ? `${toFa(t.wavelengthNm)} nm` : '—',
          dash(t.deviceModel),
          dash(t.assigneeName),
          dash(t.description),
          formatJalali(t.date),
        ])
      )
    } else {
      dataTableBlocks(
        'powerTests',
        ['محل تست', 'مقدار ثبت‌شده', 'واحد', 'طول موج', 'دستگاه', 'مسئول', 'تاریخ'],
        [16, 12, 14, 11, 15, 16, 16],
        powerTests.map((t: PowerTest) => [
          dash(t.location),
          valueCell(t),
          powerUnitLabels[t.unit],
          t.wavelengthNm !== undefined ? `${toFa(t.wavelengthNm)} nm` : '—',
          dash(t.deviceModel),
          dash(t.assigneeName),
          formatJalali(t.date),
        ])
      )
    }
    blocks.push(note('مقادیر تست توان عیناً همان اندازه‌گیری ثبت‌شده‌اند. تعیین حد قبولی/ردی بر عهده کارفرما و مشخصات پروژه است و در این گزارش خودسرانه انجام نمی‌شود.'))
  }

  // دراپ‌کابل — مرتب‌شده بر اساس زمان ثبت (H3)؛ حالت کامل: جدول جزئیات برند/مدل/کور/مجری/مبدأ (M5)
  if (show.dropCables) {
    blocks.push(sectionTitle('دراپ‌کابل', dropCables.length))
    if (dropCables.length === 0) {
      blocks.push(emptyHint('دراپ‌کابلی ثبت نشده است.'))
    } else {
      dataTableBlocks(
        'dropCables',
        ['مقصد', 'شناسه سرویس', 'کابل', 'متراژ اولیه', 'برگشتی', 'مصرفی', 'نوع مقدار مصرفی', 'روش اجرا', 'وضعیت نصب', 'تحویل', 'تاریخ'],
        [12, 9, 10, 8, 8, 8, 10, 11, 9, 8, 7],
        dropCables.map((c: DropCable) => {
          const r = computeConsumed(c.initialMeters, c.returnedMeters, c.consumedUser)
          const consumedText = r.valid && r.value !== undefined ? formatMeters(r.value) : '—'
          const sourceText = r.source === 'user' ? 'واردشده توسط کاربر' : r.source === 'auto' ? 'محاسباتی' : '—'
          return [
            dash(c.destination),
            dash(c.serviceId),
            dash(c.cableType),
            formatMeters(c.initialMeters),
            formatMeters(c.returnedMeters),
            consumedText,
            sourceText,
            c.installMethod === 'custom' && c.customMethodLabel ? dash(c.customMethodLabel) : installMethodLabels[c.installMethod],
            installStatusLabels[c.installStatus],
            deliveryStatusLabels[c.deliveryStatus],
            formatJalali(c.date),
          ]
        })
      )
      if (full) {
        const hasExtra = dropCables.some(
          (c) =>
            !!c.sourceBoxId ||
            !!c.brand?.trim() ||
            !!c.model?.trim() ||
            c.coreCount !== undefined ||
            !!c.executorName?.trim()
        )
        if (hasExtra) {
          blocks.push(sectionTitle('جزئیات بیشتر دراپ‌کابل'))
          dataTableBlocks(
            'dropCablesExtra',
            ['مقصد', 'باکس مبدأ', 'برند', 'مدل', 'تعداد کور', 'مجری'],
            [20, 18, 15, 15, 12, 20],
            dropCables.map((c: DropCable) => [
              dash(c.destination),
              boxCell(c.sourceBoxId),
              dash(c.brand),
              dash(c.model),
              c.coreCount !== undefined ? toFa(c.coreCount) : '—',
              dash(c.executorName),
            ])
          )
        }
      }
      const total = dropCables.reduce((s, c) => {
        const r = computeConsumed(c.initialMeters, c.returnedMeters, c.consumedUser)
        return s + (r.valid && r.value !== undefined ? r.value : 0)
      }, 0)
      blocks.push(...kvTableBlocks('dc-total', [['مجموع متراژ مصرفی (بدون دوباره‌شماری)', formatMeters(total)]]))
    }
  }

  // لوازم مصرفی — فقط ثبت‌های لینک‌شده به این پروژه (v1.3)
  // حالت خلاصه: مجموع به‌تفکیک قلم — حالت کامل: همهٔ ثبت‌ها با محل مصرف
  if (show.consumables) {
    const usages = data.consumableUsages
    blocks.push(sectionTitle('لوازم مصرفی مصرف‌شده', usages.length))
    if (usages.length === 0) {
      blocks.push(emptyHint('مصرف لوازم مصرفی برای این پروژه ثبت نشده است.'))
    } else {
      const itemLabel = (itemId: string): string => {
        const it = data.consumableItemsById.get(itemId)
        return it ? esc(it.name) : 'قلم حذف‌شده'
      }
      const itemUnit = (itemId: string): string => {
        const it = data.consumableItemsById.get(itemId)
        return it ? consumableUnitLabels[it.unit] : '—'
      }
      if (full) {
        // عملیات لینک‌شدهٔ هر ثبت (v1.3.1) — نمایش محل مصرف در سطح عملیات
        const opById = new Map(data.operations.map((o) => [o.id, o]))
        dataTableBlocks(
          'consumables',
          ['قلم', 'واحد', 'مقدار', 'مسیر / باکس / عملیات', 'تاریخ', 'توضیحات'],
          [22, 8, 10, 24, 12, 24],
          usages.map((u) => [
            itemLabel(u.itemId),
            itemUnit(u.itemId),
            adaptiveNum(u.quantity),
            [
              ctxCell(u.routeId, u.boxId),
              u.operationId ? `عملیات: ${esc(opById.get(u.operationId)?.title ?? '—')}` : '',
            ]
              .filter(Boolean)
              .join(' — '),
            formatJalali(u.date),
            dash(u.note),
          ])
        )
        // مجموع به‌تفکیک قلم برای دید مدیریتی
        const totals = new Map<string, number>()
        for (const u of usages) totals.set(u.itemId, (totals.get(u.itemId) ?? 0) + u.quantity)
        const totalRows = [...totals.entries()]
          .sort((a, b) => data.consumableItemsById.get(a[0])?.name.localeCompare(data.consumableItemsById.get(b[0])?.name ?? '', 'fa') ?? 0)
          .map(([itemId, qty]) => [itemLabel(itemId), itemUnit(itemId), adaptiveNum(qty)])
        blocks.push(sectionTitle('مجموع مصرف به‌تفکیک قلم'))
        dataTableBlocks(
          'consumablesTotal',
          ['قلم', 'واحد', 'مجموع مصرف'],
          [50, 20, 30],
          totalRows
        )
      } else {
        const totals = new Map<string, number>()
        for (const u of usages) totals.set(u.itemId, (totals.get(u.itemId) ?? 0) + u.quantity)
        const totalRows = [...totals.entries()]
          .sort((a, b) => data.consumableItemsById.get(a[0])?.name.localeCompare(data.consumableItemsById.get(b[0])?.name ?? '', 'fa') ?? 0)
          .map(([itemId, qty]) => [itemLabel(itemId), itemUnit(itemId), adaptiveNum(qty)])
        dataTableBlocks(
          'consumablesTotal',
          ['قلم', 'واحد', 'مجموع مصرف'],
          [50, 20, 30],
          totalRows
        )
        blocks.push(note('برای دید جزئیات هر ثبت (محل مصرف، تاریخ و توضیحات) حالت «کامل» را انتخاب کنید.'))
      }
    }
  }

  // عکس‌ها — یک عکس خراب هرگز کل گزارش را نمی‌کشد؛ فاز پیشرفت واقعی (M1)
  if (show.photos) {
    const linked = !!opts.photoIds && opts.photoIds.length > 0
    if (linked && missingSelected > 0) {
      blocks.push(
        note(`تعداد ${toFa(missingSelected)} عکس از انتخاب شما دیگر در پروژه موجود نیست و از گزارش حذف شد.`)
      )
    }
    if (photos.length > 0) {
      // عنوان شامل تعداد واقعی درج‌شده — آمار بالا کل عکس‌های پروژه را نشان می‌دهد (M4)
      blocks.push(sectionTitle(`تصاویر (درج‌شده: ${toFa(photos.length)})`))
      // بارگذاری همهٔ عکس‌ها با پیشرفت واقعی (M1)
      const loaded: Array<{ title: string; caption: string; url: string }> = []
      for (let idx = 0; idx < photos.length; idx++) {
        const p = photos[idx]
        opts.onProgress?.({ phase: 'photos', done: idx + 1, total: photos.length })
        try {
          const blob = await getPhotoBlob(p.id)
          if (!blob) {
            blocks.push(note(`تصویر «${p.title}» در دسترس نیست`))
            continue
          }
          const url = await blobToReportDataUrl(blob, mode === 'summary' ? 700 : 900, 0.8)
          loaded.push({
            title: p.title,
            caption: `${photoCategoryLabels[p.category]}${p.description ? ' — ' + p.description : ''}`,
            url,
          })
        } catch {
          blocks.push(note(`تصویر «${p.title}» قابل درج نبود`))
        }
      }
      // شبکهٔ ۲ستونه — عکس‌ها مرتب کنار هم؛ شکست صفحه فقط بین ردیف‌ها (بدون عکس افتاده تنها)
      for (let i = 0; i < loaded.length; i += 2) blocks.push(photoGridRow(loaded.slice(i, i + 2)))
    } else {
      blocks.push(emptyHint('تصویری برای درج در گزارش وجود ندارد.'))
    }
  }

  return { blocks, headerOf }
}

// صفحه‌بندی و رندر
const PAGE_W = 794 // A4 @96dpi
const PAGE_H = 1123
const PAD_X = 48
const PAD_TOP = 64
const PAD_BOTTOM = 72
const CONTENT_W = PAGE_W - PAD_X * 2
// ۲۴px حاشیه امن اضافه برای تفاوت جزئی ارتفاع رندر (جلوگیری از هم‌پوشانی با فوتر)
const CONTENT_H = PAGE_H - PAD_TOP - PAD_BOTTOM - 24
// حداقل فضای بعد از تیتر بخش/سرستون تا حداقل یک ردیف در همین صفحه جا شود (کنترل یتیم)
const KEEP_MIN = 96
/** سقف ارتفاعی که برای «نیستن تیتر یتیم» در نظر گرفته می‌شود —
 *  به‌جای حدس ثابت، ارتفاع واقعی بلوک بعدی (مثل ردیف شبکهٔ عکس ~۳۱۰px) ملاک است */
const KEEP_MAX = 340

interface PageItem {
  html: string
}

/**
 * صفحه‌بندی بلوک‌ها — هیچ ردیفی هرگز بریده نمی‌شود (C1):
 * اگر ردیفی در صفحه جا نشود، به صفحه بعد می‌رود و سرستون جدولش (tableId)
 * دوباره در بالای آن صفحه رندر می‌شود.
 */
function paginate(
  blocks: Block[],
  heights: number[],
  headerOf: Map<string, { block: Block; index: number }>
): PageItem[][] {
  const pages: PageItem[][] = [[]]
  let acc = 0
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i]
    const h = heights[i] ?? 0
    const isHeader = !!b.isTableHeader
    const isRow = !!b.tableId && !isHeader

    let mustBreak = acc > 0 && acc + h > CONTENT_H
    // تیتر بخش/سرستون تنها نماند — اگر بلوکِ بعد از آن (با ارتفاع واقعی) در همین صفحه جا نیست،
    // تیتر هم به صفحهٔ بعد می‌رود تا انتهای صفحه یتیم نماند
    if (!mustBreak && b.keepWithNext && acc > 0) {
      const nextH = heights[i + 1] ?? 0
      const need = nextH > 0 ? Math.min(nextH, KEEP_MAX) : KEEP_MIN
      if (acc + h + need > CONTENT_H) mustBreak = true
    }

    if (mustBreak) {
      pages.push([])
      acc = 0
      if (isRow) {
        // تکرار سرستون جدول در بالای صفحه جدید
        const hdr = headerOf.get(b.tableId!)
        if (hdr) {
          const hh = heights[hdr.index] ?? 0
          pages[pages.length - 1].push({ html: hdr.block.html })
          acc += hh
        }
      }
      // توجه: اگر یک ردیف تکی از کل CONTENT_H بلندتر باشد (متن چندده‌خطی نامعقول)
      // بدون شکستن خود ردیف راهی جز پذیرش سرریز نیست — در داده واقعی رخ نمی‌دهد.
    }
    pages[pages.length - 1].push({ html: b.html })
    acc += h
  }
  return pages
}

function attachHidden(html: string): { el: HTMLDivElement; cleanup: () => void } {
  const el = document.createElement('div')
  el.setAttribute('dir', 'rtl')
  el.style.cssText = `position:fixed;top:0;left:-99999px;width:${PAGE_W}px;background:#ffffff;z-index:-1;`
  el.innerHTML = html
  document.body.appendChild(el)
  return {
    el,
    cleanup: () => {
      el.remove()
    },
  }
}

function pageShell(headerHtml: string, footerHtml: string, contentHtml: string): string {
  return `<div class="fk-page" style="${base}position:relative;width:${PAGE_W}px;height:${PAGE_H}px;background:#ffffff;overflow:hidden;">
    <div style="position:absolute;top:0;right:0;left:0;height:34px;display:flex;align-items:center;justify-content:space-between;padding:0 ${PAD_X}px;border-bottom:1px solid ${C.border};font-size:9.5px;color:${C.sub};">
      ${headerHtml}
    </div>
    <div style="position:absolute;top:${PAD_TOP}px;right:${PAD_X}px;left:${PAD_X}px;">
      ${contentHtml}
    </div>
    <div style="position:absolute;bottom:0;right:0;left:0;height:40px;display:flex;align-items:center;justify-content:space-between;padding:0 ${PAD_X}px;border-top:1px solid ${C.border};font-size:9.5px;color:${C.sub};">
      ${footerHtml}
    </div>
  </div>`
}

/**
 * تولید گزارش PDF پروژه.
 * حروف فارسی به‌صورت رندر مرورگری درج می‌شوند (بدون جداافتادن حروف).
 * خروجی: blob PDF + تعداد صفحات.
 */
export async function generateProjectReport(opts: ReportOptions): Promise<GeneratedReport> {
  const project = await db.projects.get(opts.projectId)
  if (!project) throw new Error('پروژه یافت نشد')

  const [routes, boxes, operations, fusions, powerTests, dropCables, allPhotos, profiles, consumableUsages, consumableItems] = await Promise.all([
    db.routes.where('projectId').equals(project.id).filter((r) => !r.archived).toArray(),
    db.boxes.where('projectId').equals(project.id).filter((b) => !b.archived).toArray(),
    db.operations.where('projectId').equals(project.id).toArray(),
    db.fusions.where('projectId').equals(project.id).toArray(),
    db.powerTests.where('projectId').equals(project.id).toArray(),
    db.dropCables.where('projectId').equals(project.id).toArray(),
    db.photos.where('projectId').equals(project.id).toArray(),
    db.profiles.toArray(),
    db.consumableUsages.where('projectId').equals(project.id).toArray(),
    db.consumableItems.toArray(),
  ])

  // ----- مرتب‌سازی واقعی داده‌ها (H3) -----
  // مسیرها: زمان ثبت صعودی
  routes.sort((a, b) => a.createdAt - b.createdAt)
  const routeIndexById = new Map<string, number>(routes.map((r, i) => [r.id, i]))
  const routeNameById = new Map<string, string>(routes.map((r) => [r.id, r.name]))
  // باکس‌ها: گروه‌بندی بر اساس ترتیب مسیر، سپس شماره طبیعی (عددی)
  boxes.sort((a, b) => {
    const ra = routeIndexById.get(a.routeId) ?? Number.MAX_SAFE_INTEGER
    const rb = routeIndexById.get(b.routeId) ?? Number.MAX_SAFE_INTEGER
    if (ra !== rb) return ra - rb
    return a.number.localeCompare(b.number, 'fa', { numeric: true })
  })
  const boxLabelById = new Map<string, string>(boxes.map((b) => [b.id, b.number]))
  // بقیه: زمان ثبت صعودی
  operations.sort((a, b) => a.createdAt - b.createdAt)
  fusions.sort((a, b) => a.createdAt - b.createdAt)
  powerTests.sort((a, b) => a.createdAt - b.createdAt)
  dropCables.sort((a, b) => a.createdAt - b.createdAt)
  // ثبت‌های مصرف: بر اساس تاریخ مصرف، بعد زمان ثبت
  consumableUsages.sort((a, b) => (a.date === b.date ? a.createdAt - b.createdAt : a.date.localeCompare(b.date)))

  // ----- عکس‌های گزارش: اول مرتب‌سازی، بعد برش (H2) -----
  let photos: Photo[] = []
  let missingSelected = 0
  const linked = !!opts.photoIds && opts.photoIds.length > 0
  if (opts.sections.photos) {
    const sorted = [...allPhotos].sort((a, b) => a.createdAt - b.createdAt)
    if (linked) {
      const wanted = new Set(opts.photoIds)
      photos = sorted.filter((p) => wanted.has(p.id))
      // هشدار صادقانه: انتخاب‌هایی که دیگر وجود ندارند (LOW)
      missingSelected = Math.max(0, opts.photoIds!.length - photos.length)
    } else {
      photos = sorted
      if (opts.mode === 'summary') photos = photos.slice(0, 8) // «۸ عکس اول» واقعی — نه ۸ عکس تصادفی
    }
  }

  const data: ReportData = {
    project,
    routes,
    boxes,
    operations,
    fusions,
    powerTests,
    dropCables,
    photos,
    allPhotosCount: allPhotos.length,
    missingSelected,
    profiles,
    routeNameById,
    boxLabelById,
    consumableUsages,
    consumableItemsById: new Map(consumableItems.map((it) => [it.id, it])),
  }
  const { blocks, headerOf } = await buildBlocks(opts, data)

  // فونت‌ها حتماً قبل از اندازه‌گیری لود شوند وگرنه شکست صفحه اشتباه است (H4)
  if (typeof document !== 'undefined' && document.fonts?.ready) await document.fonts.ready
  opts.onProgress?.({ phase: 'measure', done: 0, total: 0 })

  // اندازه‌گیری ارتفاع بلوک‌ها — هر بلوک داخل flow-root تا marginها هم حساب شوند (H4)
  const measure = attachHidden('')
  const heights: number[] = []
  try {
    for (const b of blocks) {
      const m = document.createElement('div')
      m.style.cssText = `display:flow-root;width:${CONTENT_W}px;`
      m.innerHTML = b.html
      measure.el.appendChild(m)
      heights.push(m.getBoundingClientRect().height)
      m.remove()
    }
  } finally {
    measure.cleanup()
  }

  // صفحه‌بندی (با تکرار سرستون جدول‌ها هنگام شکست)
  const pages = paginate(blocks, heights, headerOf)

  const headerHtml = `<span>فیبرکار — ${esc(project.name)}</span><span>کد پروژه: ${dash(project.code)}</span>`
  const footerDate = `تاریخ گزارش: ${formatJalali(Date.now())}`

  const holder = attachHidden('')
  try {
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
    for (let i = 0; i < pages.length; i++) {
      // C2: هر بار فقط «یک صفحه» در DOM — html2canvas-pro کل سند را کلون می‌کند؛
      // سوار کردن همه صفحات هم‌زمان = بمب حافظه (OOM) روی گزارش‌های پراتصویر اندروید.
      holder.el.innerHTML = pageShell(
        headerHtml,
        `<span>${footerDate}</span><span>صفحه ${toFa(i + 1)} از ${toFa(pages.length)}</span>`,
        pages[i].map((it) => it.html).join('')
      )
      const pageEl = holder.el.firstElementChild as HTMLDivElement
      // اطمینان از decode شدن تصاویر همین صفحه قبل از رندر
      const imgs = holder.el.querySelectorAll('img')
      await Promise.all(Array.from(imgs).map((im) => im.decode().catch(() => {})))
      const canvas = await html2canvas(pageEl, {
        scale: 2,
        backgroundColor: '#ffffff',
        logging: false,
        useCORS: true,
      })
      const img = canvas.toDataURL('image/jpeg', 0.92)
      if (i > 0) pdf.addPage()
      pdf.addImage(img, 'JPEG', 0, 0, 210, 297, undefined, 'FAST')
      // آزادسازی فوری حافظه بوم
      canvas.width = 0
      canvas.height = 0
      opts.onProgress?.({ phase: 'pages', done: i + 1, total: pages.length })
    }
    // متادیتای PDF (LOW)
    pdf.setProperties({
      title: `گزارش ${project.name}`,
      subject: 'گزارش رسمی پروژه شبکه فیبر نوری',
      author: 'فیبرکار',
      keywords: 'فیبرکار, فیبر نوری, گزارش پروژه',
      creator: 'فیبرکار',
    })
    pdf.setLanguage('fa')
    return { blob: pdf.output('blob'), pages: pages.length }
  } finally {
    holder.cleanup()
  }
}

// ---------- اشتراک‌گذاری / دانلود ----------
/**
 * خروجی صادقانه:
 *  - 'shared'     → شیت اشتراک (بومی یا وب) باز شد
 *  - 'saved'      → فایل در پوشه اسناد دستگاه ذخیره شد (مسیر بومی)
 *  - 'downloaded' → فایل با مسیر دانلود مرورگر ذخیره شد
 * در اپ بومی هرگز به مسیر وب سقوط نمی‌کنیم؛ شکست واقعی = خطای واقعی (H5).
 */
export async function shareOrDownloadBlob(
  blob: Blob,
  filename: string
): Promise<'shared' | 'saved' | 'downloaded'> {
  const safeName = sanitizeFileName(filename, '.pdf') // M6
  // داخل اپ اندروید (APK): شیت اشتراک بومی / ذخیره در اسناد — بدون دروغ
  if (isNativeApp()) {
    const res = await nativeShareOrSaveFile(blob, safeName)
    if (res === 'shared') return 'shared'
    if (res === 'saved') return 'saved'
    throw new Error('اشتراک‌گذاری و ذخیره گزارش در دستگاه هر دو ناموفق بود')
  }
  const file = new File([blob], safeName, { type: blob.type || 'application/pdf' })
  const nav = navigator as Navigator & { canShare?: (data: { files?: File[] }) => boolean }
  if (nav.share && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: safeName })
      return 'shared'
    } catch (e) {
      if ((e as Error)?.name === 'AbortError') return 'shared' // کاربر لغو کرد
      // ادامه به دانلود مرورگر
    }
  }
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = safeName
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10000)
  return 'downloaded'
}
