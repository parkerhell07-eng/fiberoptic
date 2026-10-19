// فایبرکار — تولید گزارش PDF فارسی و راست‌چین
// روش: رندر HTML در مرورگر (اتصال صحیح حروف فارسی) → html2canvas-pro → jsPDF
// تمام استایل‌ها inline با رنگ‌های hex هستند تا رندر پایدار باشد.
import { jsPDF } from 'jspdf'
import html2canvas from 'html2canvas-pro'
import type { Box, DropCable, Fusion, Operation, Photo, PowerTest, Profile, Project, Route } from './types'
import { db } from './localdb'
import {
  boxStatusLabels,
  deliveryStatusLabels,
  installMethodLabels,
  installStatusLabels,
  operationStatusLabels,
  operationTypeLabels,
  photoCategoryLabels,
  powerUnitLabels,
  projectStatusLabels,
} from './labels'
import { computeConsumed, formatJalali, formatJalaliDateTime, formatMeters, formatNum, toFa } from './persian'
import { blobToReportDataUrl } from './images'
import { isNativeApp, nativeShareOrSaveFile } from './native-bridge'

export interface ReportSections {
  info: boolean
  routes: boolean
  boxes: boolean
  operations: boolean
  fusions: boolean
  powerTests: boolean
  dropCables: boolean
  photos: boolean
}

export interface ReportOptions {
  projectId: string
  mode: 'summary' | 'full'
  sections: ReportSections
  photoIds?: string[] // در صورت انتخاب، فقط این عکس‌ها
  onProgress?: (done: number, total: number) => void
}

export const defaultSections: ReportSections = {
  info: true,
  routes: true,
  boxes: true,
  operations: true,
  fusions: true,
  powerTests: true,
  dropCables: true,
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
}

function dash(s: string | undefined | null): string {
  const v = String(s ?? '').trim()
  return v === '' ? '—' : esc(v)
}

// ---------- بلوک‌های محتوایی ----------
type Block = { html: string }

function sectionTitle(text: string, count?: number): Block {
  return {
    html: `<div style="${base}display:flex;align-items:center;gap:8px;margin:18px 0 8px 0;">
      <div style="width:6px;height:20px;background:${C.accent};border-radius:3px;"></div>
      <div style="font-size:15px;font-weight:700;color:${C.accent};">${esc(text)}</div>
      ${count !== undefined ? `<div style="font-size:11px;color:${C.sub};background:${C.accentLight};border-radius:999px;padding:2px 10px;">${toFa(count)} مورد</div>` : ''}
    </div>`,
  }
}

function kvTable(rows: Array<[string, string]>): Block {
  return {
    html: `<table style="${base}width:100%;border-collapse:collapse;font-size:11.5px;">
      ${rows
        .map(
          ([k, v], i) => `<tr style="background:${i % 2 ? C.zebra : '#ffffff'};">
        <td style="border:1px solid ${C.border};padding:6px 10px;font-weight:600;color:${C.sub};width:32%;">${esc(k)}</td>
        <td style="border:1px solid ${C.border};padding:6px 10px;">${v}</td>
      </tr>`
        )
        .join('')}
    </table>`,
  }
}

function dataTable(headers: string[], rows: string[][], zebra = true): Block {
  return {
    html: `<table style="${base}width:100%;border-collapse:collapse;font-size:10.5px;">
      <thead><tr>${headers
        .map(
          (h) =>
            `<th style="border:1px solid ${C.border};background:${C.accent};color:#ffffff;padding:6px 8px;font-weight:600;text-align:right;white-space:nowrap;">${esc(h)}</th>`
        )
        .join('')}</tr></thead>
      <tbody>${rows
        .map(
          (r, i) =>
            `<tr style="background:${zebra && i % 2 ? C.zebra : '#ffffff'};">${r
              .map((c) => `<td style="border:1px solid ${C.border};padding:5px 8px;">${c}</td>`)
              .join('')}</tr>`
        )
        .join('')}</tbody>
    </table>`,
  }
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

function photoBlock(dataUrl: string, title: string, caption: string, w: number, h: number): Block {
  const maxH = 300
  const ratio = Math.min(1, maxH / h)
  const ph = Math.round(h * ratio)
  return {
    html: `<div style="${base}margin:10px 0;text-align:center;">
      <div style="font-size:10.5px;font-weight:600;color:${C.sub};margin-bottom:4px;">${esc(title)}</div>
      <img src="${dataUrl}" style="height:${ph}px;max-width:100%;border:1px solid ${C.border};border-radius:10px;" />
      ${caption ? `<div style="font-size:10px;color:${C.sub};margin-top:4px;">${esc(caption)}</div>` : ''}
    </div>`,
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

function longParagraphs(text: string, chunk = 900): Block[] {
  const t = String(text ?? '').trim()
  if (!t) return []
  if (t.length <= chunk) return [paragraph(t)]
  const out: Block[] = []
  for (let i = 0; i < t.length; i += chunk) out.push(paragraph(t.slice(i, i + chunk)))
  return out
}

// ---------- ساخت محتوا ----------
async function buildBlocks(opts: ReportOptions, data: ReportData): Promise<Block[]> {
  const { project, routes, boxes, operations, fusions, powerTests, dropCables, photos, profiles } = data
  const mode = opts.mode
  const blocks: Block[] = []
  const show = opts.sections

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
    if (mode === 'full') {
      if (contractor) infoRows.push(['پیمانکار', dash(`${contractor.firstName} ${contractor.lastName}`)])
      if (executor) infoRows.push(['مجری', dash(`${executor.firstName} ${executor.lastName}`)])
    }
    blocks.push(kvTable(infoRows))
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
        { label: 'عکس‌ها', value: toFa(photos.length) },
      ])
    )
  }

  // مسیرها
  if (show.routes) {
    blocks.push(sectionTitle('مسیرهای شبکه', routes.length))
    if (routes.length === 0) blocks.push(emptyHint('مسیری برای این پروژه ثبت نشده است.'))
    else
      blocks.push(
        dataTable(
          ['نام مسیر', 'کد', mode === 'full' ? 'توضیحات' : '—'],
          routes.map((r) => [dash(r.name), dash(r.code), mode === 'full' ? dash(r.description) : ''])
        )
      )
  }

  // باکس‌ها
  if (show.boxes) {
    blocks.push(sectionTitle('باکس‌ها', boxes.length))
    if (boxes.length === 0) blocks.push(emptyHint('باکسی برای این پروژه ثبت نشده است.'))
    else {
      const routeName = (id?: string) => dash(routes.find((r) => r.id === id)?.name)
      blocks.push(
        dataTable(
          ['شماره باکس', 'مسیر', 'محل نصب', 'مشخصات کابل', 'وضعیت', ...(mode === 'full' ? ['توضیحات'] : [])],
          boxes.map((b: Box) => [
            dash(b.number),
            routeName(b.routeId),
            dash(b.location),
            dash(b.cableSpec),
            boxStatusLabels[b.status],
            ...(mode === 'full' ? [dash(b.description)] : []),
          ])
        )
      )
    }
  }

  // عملیات
  if (show.operations) {
    blocks.push(sectionTitle('عملیات اجرایی', operations.length))
    if (operations.length === 0) blocks.push(emptyHint('عملیاتی ثبت نشده است.'))
    else {
      blocks.push(
        dataTable(
          ['عنوان', 'نوع', 'تاریخ', 'مسئول', 'وضعیت', ...(mode === 'full' ? ['توضیحات'] : [])],
          operations.map((o: Operation) => [
            dash(o.title),
            o.type === 'custom' && o.customTypeLabel ? dash(o.customTypeLabel) : operationTypeLabels[o.type],
            formatJalali(o.date),
            dash(o.assigneeName),
            operationStatusLabels[o.status],
            ...(mode === 'full' ? [dash(o.description)] : []),
          ])
        )
      )
      if (mode === 'full')
        for (const o of operations) {
          if (o.techSpecs) blocks.push(...longParagraphs(`مشخصات فنی «${o.title}»: ${o.techSpecs}`))
        }
    }
  }

  // فیوژن‌ها
  if (show.fusions) {
    blocks.push(sectionTitle('فیوژن', fusions.length))
    if (fusions.length === 0) blocks.push(emptyHint('اتصال فیوژنی ثبت نشده است.'))
    else
      blocks.push(
        dataTable(
          ['شناسه اتصال', 'شماره تارها', 'تیوب', 'مشخصات کابل', 'دستگاه', 'نتیجه ثبت‌شده', 'تاریخ'],
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
      )
    blocks.push(note('نتیجه فیوژن صرفاً همان مقداری است که در محل ثبت شده است؛ هیچ مقدار ساختگی درج نمی‌شود.'))
  }

  // تست توان
  if (show.powerTests) {
    blocks.push(sectionTitle('تست توان', powerTests.length))
    if (powerTests.length === 0) blocks.push(emptyHint('تست توانی ثبت نشده است.'))
    else
      blocks.push(
        dataTable(
          ['محل تست', 'مقدار ثبت‌شده', 'واحد', 'طول موج', 'دستگاه', 'مسئول', 'تاریخ'],
          powerTests.map((t: PowerTest) => [
            dash(t.location),
            formatNum(t.value, 2),
            powerUnitLabels[t.unit],
            t.wavelengthNm !== undefined ? `${toFa(t.wavelengthNm)} nm` : '—',
            dash(t.deviceModel),
            dash(t.assigneeName),
            formatJalali(t.date),
          ])
        )
      )
    blocks.push(note('مقادیر تست توان عیناً همان اندازه‌گیری ثبت‌شده‌اند. تعیین حد قبولی/ردی بر عهده کارفرما و مشخصات پروژه است و در این گزارش خودسرانه انجام نمی‌شود.'))
  }

  // دراپ‌کابل
  if (show.dropCables) {
    blocks.push(sectionTitle('دراپ‌کابل', dropCables.length))
    if (dropCables.length === 0) blocks.push(emptyHint('دراپ‌کابلی ثبت نشده است.'))
    else {
      blocks.push(
        dataTable(
          ['مقصد', 'شناسه سرویس', 'کابل', 'متراژ اولیه', 'برگشتی', 'مصرفی', 'نوع مقدار مصرفی', 'روش اجرا', 'وضعیت نصب', 'تحویل', 'تاریخ'],
          dropCables.map((c: DropCable) => {
            const r = computeConsumed(c.initialMeters, c.returnedMeters, c.consumedUser)
            const consumedText =
              r.valid && r.value !== undefined ? formatMeters(r.value) : '—'
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
      )
      const total = dropCables.reduce((s, c) => {
        const r = computeConsumed(c.initialMeters, c.returnedMeters, c.consumedUser)
        return s + (r.valid && r.value !== undefined ? r.value : 0)
      }, 0)
      blocks.push(kvTable([['مجموع متراژ مصرفی (بدون دوباره‌شماری)', formatMeters(total)]]))
    }
  }

  // عکس‌ها
  if (show.photos && photos.length > 0) {
    blocks.push(sectionTitle('تصاویر', photos.length))
    for (const p of photos) {
      const url = await blobToReportDataUrl(p.blob, mode === 'summary' ? 700 : 900, 0.8)
      blocks.push(photoBlock(url, p.title, `${photoCategoryLabels[p.category]}${p.description ? ' — ' + p.description : ''}`, p.width, p.height))
    }
  }

  return blocks
}

interface ReportData {
  project: Project
  routes: Route[]
  boxes: Box[]
  operations: Operation[]
  fusions: Fusion[]
  powerTests: PowerTest[]
  dropCables: DropCable[]
  photos: Photo[]
  profiles: Profile[]
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
 */
export async function generateProjectReport(opts: ReportOptions): Promise<Blob> {
  const project = await db.projects.get(opts.projectId)
  if (!project) throw new Error('پروژه یافت نشد')

  const [routes, boxes, operations, fusions, powerTests, dropCables, allPhotos, profiles] = await Promise.all([
    db.routes.where('projectId').equals(project.id).filter((r) => !r.archived).toArray(),
    db.boxes.where('projectId').equals(project.id).filter((b) => !b.archived).toArray(),
    db.operations.where('projectId').equals(project.id).toArray(),
    db.fusions.where('projectId').equals(project.id).toArray(),
    db.powerTests.where('projectId').equals(project.id).toArray(),
    db.dropCables.where('projectId').equals(project.id).toArray(),
    db.photos.where('projectId').equals(project.id).toArray(),
    db.profiles.toArray(),
  ])

  // عکس‌های گزارش: انتخابی یا بر اساس حالت
  let photos: Photo[] = []
  const linked = opts.photoIds && opts.photoIds.length > 0
  if (opts.sections.photos) {
    photos = linked ? allPhotos.filter((p) => opts.photoIds!.includes(p.id)) : allPhotos
    if (!linked && opts.mode === 'summary') photos = photos.slice(0, 8)
    photos.sort((a, b) => a.createdAt - b.createdAt)
  }

  const data: ReportData = { project, routes, boxes, operations, fusions, powerTests, dropCables, photos, profiles }
  const blocks = await buildBlocks(opts, data)
  opts.onProgress?.(0, blocks.length)

  // اندازه‌گیری ارتفاع بلوک‌ها
  const measure = attachHidden(`<div style="width:${CONTENT_W}px;"></div>`)
  const measureWrap = measure.el.firstElementChild as HTMLDivElement
  const heights: number[] = []
  for (const b of blocks) {
    const tmp = document.createElement('div')
    tmp.innerHTML = b.html
    const node = tmp.firstElementChild as HTMLElement
    measureWrap.appendChild(node)
    heights.push(node.getBoundingClientRect().height)
    node.remove()
  }
  measure.cleanup()

  // صفحه‌بندی
  const pages: Block[][] = [[]]
  let acc = 0
  for (let i = 0; i < blocks.length; i++) {
    const h = heights[i]
    if (acc + h > CONTENT_H && acc > 0) {
      pages.push([])
      acc = 0
    }
    pages[pages.length - 1].push(blocks[i])
    acc += h
  }

  const headerHtml = `<span>فیبرکار — ${esc(project.name)}</span><span>کد پروژه: ${dash(project.code)}</span>`
  const footerDate = `تاریخ گزارش: ${formatJalali(Date.now())}`
  const pagesHtml = pages.map((pageBlocks, idx) =>
    pageShell(
      headerHtml,
      `<span>${footerDate}</span><span>صفحه ${toFa(idx + 1)} از ${toFa(pages.length)}</span>`,
      pageBlocks.map((b) => b.html).join('')
    )
  )

  const holder = attachHidden(pagesHtml.join(''))
  try {
    if (document.fonts?.ready) await document.fonts.ready
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
    const pageEls = holder.el.querySelectorAll<HTMLDivElement>('.fk-page')
    const total = pageEls.length
    for (let i = 0; i < total; i++) {
      const canvas = await html2canvas(pageEls[i], {
        scale: 2,
        backgroundColor: '#ffffff',
        logging: false,
        useCORS: true,
      })
      const img = canvas.toDataURL('image/jpeg', 0.92)
      if (i > 0) pdf.addPage()
      pdf.addImage(img, 'JPEG', 0, 0, 210, 297, undefined, 'FAST')
      canvas.width = 0
      canvas.height = 0
      opts.onProgress?.(i + 1, total)
    }
    return pdf.output('blob')
  } finally {
    holder.cleanup()
  }
}

// ---------- اشتراک‌گذاری / دانلود ----------
export async function shareOrDownloadBlob(blob: Blob, filename: string): Promise<'shared' | 'downloaded'> {
  // داخل اپ اندروید (APK): استفاده از شیت اشتراک بومی سیستم
  if (isNativeApp()) {
    try {
      const res = await nativeShareOrSaveFile(blob, filename)
      return res === 'shared' ? 'shared' : 'downloaded'
    } catch {
      // در صورت خطای بومی، ادامه به مسیر وب
    }
  }
  const file = new File([blob], filename, { type: blob.type || 'application/pdf' })
  const nav = navigator as Navigator & { canShare?: (data: { files?: File[] }) => boolean }
  if (nav.share && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: filename })
      return 'shared'
    } catch (e) {
      if ((e as Error)?.name === 'AbortError') return 'shared' // کاربر لغو کرد
      // ادامه به دانلود
    }
  }
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10000)
  return 'downloaded'
}
