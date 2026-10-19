// فایبرکار — بررسی سلامت داده‌ها (رکوردهای بی‌پیوند/یتیم، مغایرت متراژ، وضعیت‌های ناشناخته)
// هدف: صداقت داده — مشکلات فقط «گزارش» می‌شوند؛ هیچ رکوردی اینجا حذف نمی‌شود
// (تنها استثنا عکس‌های یتیم است که از UI قابل پاک‌سازی‌اند).
import { db } from './localdb'
import { computeConsumed } from './persian'
import {
  boxStatusLabels,
  deliveryStatusLabels,
  installStatusLabels,
  operationStatusLabels,
  operationTypeLabels,
  projectStatusLabels,
} from './labels'
import type { Box, DropCable, Fusion, Operation, PowerTest, Project, Route } from './types'

export interface OrphanRecord {
  table: string // photos | operations | fusions | powerTests | dropCables | boxes | routes
  id: string
  reason: string // توضیح فارسی برای نمایش
}

export interface MeterAnomaly {
  id: string
  message: string
}

export interface UnknownStatus {
  table: string
  id: string
}

export interface DataHealthReport {
  orphanPhotos: string[]
  orphanRecords: OrphanRecord[]
  meterAnomalies: MeterAnomaly[]
  unknownStatus: UnknownStatus[]
  checkedAt: number
}

/** برچسب فارسی جدول برای گزارش‌ها */
export function tableFa(name: string): string {
  const map: Record<string, string> = {
    photos: 'عکس',
    operations: 'عملیات',
    fusions: 'فیوژن',
    powerTests: 'تست توان',
    dropCables: 'دراپ‌کابل',
    boxes: 'باکس',
    routes: 'مسیر',
    projects: 'پروژه',
    profiles: 'پروفایل',
  }
  return map[name] ?? name
}

/** برچسب کوتاه و قابل فهم رکورد برای پیام‌های گزارش */
function humanLabel(table: string, rec: Record<string, unknown>): string {
  const s = (k: string) => (typeof rec[k] === 'string' ? (rec[k] as string) : '')
  switch (table) {
    case 'operations':
      return s('title') || operationTypeLabels[s('type') as keyof typeof operationTypeLabels] || 'بدون عنوان'
    case 'fusions':
      return s('connectionId') || s('fiberNumbers') || 'بدون شناسه'
    case 'powerTests':
      return s('location') || 'بدون محل'
    case 'dropCables':
      return s('destination') || s('serviceId') || 'بدون مقصد'
    case 'boxes':
      return s('number') || 'بدون شماره'
    case 'routes':
      return s('name') || s('code') || 'بدون نام'
    case 'projects':
      return s('name') || 'بدون نام'
    default:
      return s('title') || 'بدون عنوان'
  }
}

const MISSING = 'یافت نشد'

export async function scanDataHealth(): Promise<DataHealthReport> {
  const [projects, routes, boxes, operations, fusions, powerTests, dropCables, photos] = await Promise.all([
    db.projects.toArray(),
    db.routes.toArray(),
    db.boxes.toArray(),
    db.operations.toArray(),
    db.fusions.toArray(),
    db.powerTests.toArray(),
    db.dropCables.toArray(),
    db.photos.toArray(),
  ])

  const projectIds = new Set(projects.map((p: Project) => p.id))
  const routeIds = new Set(routes.map((r: Route) => r.id))
  const boxIds = new Set(boxes.map((b: Box) => b.id))
  const operationIds = new Set(operations.map((o: Operation) => o.id))
  const fusionIds = new Set(fusions.map((f: Fusion) => f.id))
  const powerTestIds = new Set(powerTests.map((t: PowerTest) => t.id))
  const dropCableIds = new Set(dropCables.map((c: DropCable) => c.id))

  const orphanPhotos: string[] = []
  const orphanRecords: OrphanRecord[] = []
  const meterAnomalies: MeterAnomaly[] = []
  const unknownStatus: UnknownStatus[] = []

  // ---------- ۱) عکس‌های یتیم ----------
  // هر پیوندِ «موجود» باید به والد معتبر اشاره کند؛ اگر هیچ پیوند زنده‌ای نماند → عکس یتیم است.
  for (const ph of photos) {
    const links: Array<[string, string | undefined, Set<string>]> = [
      ['projects', ph.projectId, projectIds],
      ['routes', ph.routeId, routeIds],
      ['boxes', ph.boxId, boxIds],
      ['operations', ph.operationId, operationIds],
      ['fusions', ph.fusionId, fusionIds],
      ['powerTests', ph.powerTestId, powerTestIds],
      ['dropCables', ph.dropCableId, dropCableIds],
    ]
    const present = links.filter(([, v]) => typeof v === 'string' && !!v) as Array<[string, string, Set<string>]>
    if (present.length === 0 || !present.some(([, v, ids]) => ids.has(v))) {
      orphanPhotos.push(ph.id)
    }
  }

  // ---------- ۲) رکوردهای بی‌پیوند ----------
  // projectId الزامی است؛ routeId/boxId/sourceBoxId در صورت وجود باید معتبر باشند.
  type Parented = { id: string; projectId?: string; routeId?: string; boxId?: string; sourceBoxId?: string } & Record<string, unknown>
  function checkParents(table: string, rec: Parented, requireProject = true): void {
    const label = `«${humanLabel(table, rec)}»`
    const projectId = rec.projectId
    if (requireProject && (typeof projectId !== 'string' || !projectId)) {
      orphanRecords.push({ table, id: rec.id, reason: `${label} — پروژهٔ والد ${MISSING}` })
      return
    }
    if (typeof projectId === 'string' && projectId && !projectIds.has(projectId)) {
      orphanRecords.push({ table, id: rec.id, reason: `${label} — پروژهٔ والد ${MISSING}` })
      return
    }
    if (typeof rec.routeId === 'string' && rec.routeId && !routeIds.has(rec.routeId)) {
      orphanRecords.push({ table, id: rec.id, reason: `${label} — مسیر والد ${MISSING}` })
    }
    if (typeof rec.boxId === 'string' && rec.boxId && !boxIds.has(rec.boxId)) {
      orphanRecords.push({ table, id: rec.id, reason: `${label} — باکس والد ${MISSING}` })
    }
    if (typeof rec.sourceBoxId === 'string' && rec.sourceBoxId && !boxIds.has(rec.sourceBoxId)) {
      orphanRecords.push({ table, id: rec.id, reason: `${label} — باکس مبدأ ${MISSING}` })
    }
  }

  routes.forEach((r) => checkParents('routes', r as unknown as Parented))
  boxes.forEach((b) => checkParents('boxes', b as unknown as Parented))
  operations.forEach((o) => checkParents('operations', o as unknown as Parented))
  fusions.forEach((f) => checkParents('fusions', f as unknown as Parented))
  powerTests.forEach((t) => checkParents('powerTests', t as unknown as Parented))
  dropCables.forEach((c) => checkParents('dropCables', c as unknown as Parented))

  // ---------- ۳) مغایرت متراژ دراپ‌کابل ----------
  // اگر رکورد داده متراژ دارد اما computeConsumed آن را نامعتبر می‌داند → هشدار (حذف نمی‌شود)
  for (const c of dropCables) {
    const hasMeterage =
      c.initialMeters !== undefined || c.returnedMeters !== undefined || c.consumedUser !== undefined
    if (!hasMeterage) continue
    const res = computeConsumed(c.initialMeters, c.returnedMeters, c.consumedUser)
    if (!res.valid) {
      meterAnomalies.push({
        id: c.id,
        message: `دراپ‌کابل «${humanLabel('dropCables', c as unknown as Record<string, unknown>)}» — ${res.message ?? 'مقادیر متراژ ناسازگار است'}`,
      })
    }
  }

  // ---------- ۴) وضعیت‌های ناشناخته ----------
  for (const p of projects) {
    if (!(p.status in projectStatusLabels)) unknownStatus.push({ table: 'projects', id: p.id })
  }
  for (const b of boxes) {
    if (!(b.status in boxStatusLabels)) unknownStatus.push({ table: 'boxes', id: b.id })
  }
  for (const o of operations) {
    if (!(o.status in operationStatusLabels)) unknownStatus.push({ table: 'operations', id: o.id })
  }
  for (const c of dropCables) {
    if (!(c.installStatus in installStatusLabels) || !(c.deliveryStatus in deliveryStatusLabels)) {
      unknownStatus.push({ table: 'dropCables', id: c.id })
    }
  }

  return { orphanPhotos, orphanRecords, meterAnomalies, unknownStatus, checkedAt: Date.now() }
}
