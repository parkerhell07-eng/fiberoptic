// فایبرکار — پایگاه داده محلی (IndexedDB via Dexie)
// کاملاً آفلاین؛ هیچ داده‌ای به سرور ارسال نمی‌شود.
//
// v2 تغییرات:
//  - جدول جداگانه photoBlobs: لیست‌ها هرگز blob عکس را به RAM نمی‌آورند (جلوگیری از OOM)
//  - ایندکس pinned برای پروژه‌ها (سنجاق‌کردن)
import Dexie, { type Table, type Transaction, type UpdateSpec } from 'dexie'
import type {
  Box,
  ConsumedResult,
  DropCable,
  Fusion,
  LastBackupInfo,
  Operation,
  Photo,
  PhotoBlobRow,
  PhotoLink,
  PowerTest,
  Profile,
  Project,
  ProjectStatus,
  Route,
} from './types'
import { computeConsumed, isoToJalali, jalaliMonthNames, jalaliMonthWindow, todayISO } from './persian'
import { profileRoleLabels } from './labels'

// ---------- شناسه و زمان ----------
export function uid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

export function nowMs(): number {
  return Date.now()
}

// ---------- تعریف دیتابیس ----------
export class FiberDB extends Dexie {
  projects!: Table<Project, string>
  routes!: Table<Route, string>
  boxes!: Table<Box, string>
  operations!: Table<Operation, string>
  fusions!: Table<Fusion, string>
  powerTests!: Table<PowerTest, string>
  dropCables!: Table<DropCable, string>
  profiles!: Table<Profile, string>
  photos!: Table<Photo, string>
  photoBlobs!: Table<PhotoBlobRow, string>
  settings!: Table<{ key: string; value: unknown }, string>

  constructor() {
    super('fiberkar')
    this.version(1).stores({
      projects: 'id, code, status, archived, createdAt',
      routes: 'id, projectId, code, archived, createdAt',
      boxes: 'id, projectId, routeId, number, status, archived, createdAt',
      operations: 'id, projectId, routeId, boxId, type, date, status, createdAt',
      fusions: 'id, projectId, routeId, boxId, operationId, connectionId, createdAt',
      powerTests: 'id, projectId, routeId, boxId, date, createdAt',
      dropCables: 'id, projectId, routeId, sourceBoxId, date, createdAt',
      profiles: 'id, firstName, lastName, createdAt',
      photos: 'id, projectId, routeId, boxId, operationId, fusionId, powerTestId, dropCableId, category, createdAt',
      settings: 'key',
    })
    this.version(2)
      .stores({
        // فقط جدول‌های تغییرکرده — بقیه از نسخه قبل ارث می‌رسند
        projects: 'id, code, status, archived, pinned, createdAt',
        photoBlobs: 'id',
      })
      .upgrade(async (tx: Transaction) => {
        // انتقال blob عکس‌ها از photos به photoBlobs (مهاجرت شفاف)
        const photosTable = tx.table('photos')
        const blobsTable = tx.table('photoBlobs')
        const all = (await photosTable.toArray()) as Array<Photo & { blob?: Blob }>
        const blobRows: PhotoBlobRow[] = []
        for (const p of all) {
          if (p.blob) {
            blobRows.push({ id: p.id, blob: p.blob })
            delete p.blob
          }
        }
        if (blobRows.length > 0) await blobsTable.bulkPut(blobRows)
        if (all.length > 0) await photosTable.bulkPut(all as Photo[])
      })
  }
}

// نمونه تنبل (ایمن برای SSR)
let _db: FiberDB | undefined
export function getDb(): FiberDB {
  if (!_db) _db = new FiberDB()
  return _db
}

/** دسترسی به دیتابیس — در محیط مرورگر استفاده شود */
export const db: FiberDB = new Proxy({} as FiberDB, {
  get(_t, prop) {
    const real = getDb() as unknown as Record<string | symbol, unknown>
    const v = real[prop]
    return typeof v === 'function' ? v.bind(real) : v
  },
})

/** خطای رکورد یافت‌نشده — برای updateهایی که رکورد حذف‌شده را به‌روزرسانی می‌کنند */
export class RecordNotFoundError extends Error {
  constructor(entity: string) {
    super(`${entity} یافت نشد (حذف‌شده)`)
    this.name = 'RecordNotFoundError'
  }
}

/** update Dexie که در نبود رکورد پرتاب می‌کند (ذخیره ارواح را نمی‌پذیرد) */
async function updateStrict<T>(table: Table<T, string>, id: string, patch: Partial<T>, entity: string): Promise<void> {
  const n = await table.update(id, patch as UpdateSpec<T>)
  if (n === 0) {
    // شاید واقعاً نباشد؛ بررسی نهایی
    const exists = await table.get(id)
    if (!exists) throw new RecordNotFoundError(entity)
  }
}

// ---------- تنظیمات ----------
export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const row = await db.settings.get(key)
  return (row?.value as T) ?? fallback
}

export async function setSetting(key: string, value: unknown): Promise<void> {
  await db.settings.put({ key, value })
}

export async function getLastBackupInfo(): Promise<LastBackupInfo | null> {
  return getSetting<LastBackupInfo | null>('lastBackup', null)
}

// ---------- پروژه ----------
export type ProjectInput = Omit<Project, 'id' | 'createdAt' | 'updatedAt' | 'archived'>
export async function createProject(input: ProjectInput): Promise<Project> {
  const t = nowMs()
  const rec: Project = { ...input, id: uid(), archived: 0, pinned: 0, createdAt: t, updatedAt: t }
  await db.projects.add(rec)
  return rec
}

export async function updateProject(id: string, patch: Partial<Project>): Promise<void> {
  await updateStrict(db.projects, id, { ...patch, updatedAt: nowMs() }, 'پروژه')
}

export async function setProjectArchived(id: string, archived: 0 | 1): Promise<void> {
  await updateStrict(db.projects, id, { archived, updatedAt: nowMs() }, 'پروژه')
}

export async function setProjectPinned(id: string, pinned: 0 | 1): Promise<void> {
  await updateStrict(db.projects, id, { pinned, updatedAt: nowMs() }, 'پروژه')
}

export async function deleteProjectCascade(id: string): Promise<void> {
  await db.transaction(
    'rw',
    [db.projects, db.routes, db.boxes, db.operations, db.fusions, db.powerTests, db.dropCables, db.photos, db.photoBlobs],
    async () => {
      // حذف عکس‌ها بر اساس هر هفت لینک (اطمینان از نبود عکس یتیم حتی با لینک مندرس)
      const routeIds = (await db.routes.where('projectId').equals(id).toArray()).map((r) => r.id)
      const boxIds = (await db.boxes.where('projectId').equals(id).toArray()).map((b) => b.id)
      const opIds = (await db.operations.where('projectId').equals(id).toArray()).map((o) => o.id)
      const fusionIds = (await db.fusions.where('projectId').equals(id).toArray()).map((f) => f.id)
      const ptIds = (await db.powerTests.where('projectId').equals(id).toArray()).map((p) => p.id)
      const dcIds = (await db.dropCables.where('projectId').equals(id).toArray()).map((c) => c.id)

      const photoSets = await Promise.all([
        db.photos.where('projectId').equals(id).toArray(),
        db.photos.where('routeId').anyOf(routeIds).toArray(),
        db.photos.where('boxId').anyOf(boxIds).toArray(),
        db.photos.where('operationId').anyOf(opIds).toArray(),
        db.photos.where('fusionId').anyOf(fusionIds).toArray(),
        db.photos.where('powerTestId').anyOf(ptIds).toArray(),
        db.photos.where('dropCableId').anyOf(dcIds).toArray(),
      ])
      const photoIds = [...new Set(photoSets.flat().map((p) => p.id))]
      await db.photos.bulkDelete(photoIds)
      await db.photoBlobs.bulkDelete(photoIds)

      await db.dropCables.where('projectId').equals(id).delete()
      await db.powerTests.where('projectId').equals(id).delete()
      await db.fusions.where('projectId').equals(id).delete()
      await db.operations.where('projectId').equals(id).delete()
      await db.boxes.where('projectId').equals(id).delete()
      await db.routes.where('projectId').equals(id).delete()
      await db.projects.delete(id)
    }
  )
}

// ---------- مسیر ----------
export type RouteInput = Omit<Route, 'id' | 'createdAt' | 'updatedAt' | 'archived'>
export async function createRoute(input: RouteInput): Promise<Route> {
  const t = nowMs()
  const rec: Route = { ...input, id: uid(), archived: 0, createdAt: t, updatedAt: t }
  await db.routes.add(rec)
  return rec
}

export async function updateRoute(id: string, patch: Partial<Route>): Promise<void> {
  await updateStrict(db.routes, id, { ...patch, updatedAt: nowMs() }, 'مسیر')
}

export async function setRouteArchived(id: string, archived: 0 | 1): Promise<void> {
  await updateStrict(db.routes, id, { archived, updatedAt: nowMs() }, 'مسیر')
}

export async function deleteRouteCascade(id: string): Promise<void> {
  await db.transaction(
    'rw',
    [db.routes, db.boxes, db.operations, db.fusions, db.powerTests, db.dropCables, db.photos, db.photoBlobs],
    async () => {
      const boxIds = (await db.boxes.where('routeId').equals(id).toArray()).map((b) => b.id)
      const opIds = (await db.operations.where('routeId').equals(id).toArray()).map((o) => o.id)
      const fusionIds = (await db.fusions.where('routeId').equals(id).toArray()).map((f) => f.id)
      const ptIds = (await db.powerTests.where('routeId').equals(id).toArray()).map((p) => p.id)
      const dcIds = (await db.dropCables.where('routeId').equals(id).toArray()).map((c) => c.id)

      const photoSets = await Promise.all([
        db.photos.where('routeId').equals(id).toArray(),
        db.photos.where('boxId').anyOf(boxIds).toArray(),
        db.photos.where('operationId').anyOf(opIds).toArray(),
        db.photos.where('fusionId').anyOf(fusionIds).toArray(),
        db.photos.where('powerTestId').anyOf(ptIds).toArray(),
        db.photos.where('dropCableId').anyOf(dcIds).toArray(),
      ])
      const photoIds = [...new Set(photoSets.flat().map((p) => p.id))]
      await db.photos.bulkDelete(photoIds)
      await db.photoBlobs.bulkDelete(photoIds)

      await db.dropCables.where('routeId').equals(id).delete()
      await db.powerTests.where('routeId').equals(id).delete()
      await db.fusions.where('routeId').equals(id).delete()
      await db.operations.where('routeId').equals(id).delete()
      await db.boxes.where('routeId').equals(id).delete()
      await db.routes.delete(id)
    }
  )
}

// ---------- باکس ----------
export type BoxInput = Omit<Box, 'id' | 'createdAt' | 'updatedAt' | 'archived'>
export async function createBox(input: BoxInput): Promise<Box> {
  const t = nowMs()
  const rec: Box = { ...input, id: uid(), archived: 0, createdAt: t, updatedAt: t }
  await db.boxes.add(rec)
  return rec
}

export async function updateBox(id: string, patch: Partial<Box>): Promise<void> {
  await updateStrict(db.boxes, id, { ...patch, updatedAt: nowMs() }, 'باکس')
  // هم‌زمانی لینک عکس‌های باکس با والد جدید (اگر مسیر/پروژه باکس تغییر کند)
  if (patch.projectId !== undefined || patch.routeId !== undefined) {
    const photoPatch: Partial<Photo> = {}
    if (patch.projectId !== undefined) photoPatch.projectId = patch.projectId
    if (patch.routeId !== undefined) photoPatch.routeId = patch.routeId
    await db.photos.where('boxId').equals(id).modify(photoPatch)
  }
}

export async function setBoxArchived(id: string, archived: 0 | 1): Promise<void> {
  await updateStrict(db.boxes, id, { archived, updatedAt: nowMs() }, 'باکس')
}

export async function deleteBoxCascade(id: string): Promise<void> {
  await db.transaction('rw', [db.boxes, db.operations, db.fusions, db.powerTests, db.dropCables, db.photos, db.photoBlobs], async () => {
    const opIds = (await db.operations.where('boxId').equals(id).toArray()).map((o) => o.id)
    const fusionIds = (await db.fusions.where('boxId').equals(id).toArray()).map((f) => f.id)
    const ptIds = (await db.powerTests.where('boxId').equals(id).toArray()).map((p) => p.id)

    const photoSets = await Promise.all([
      db.photos.where('boxId').equals(id).toArray(),
      db.photos.where('operationId').anyOf(opIds).toArray(),
      db.photos.where('fusionId').anyOf(fusionIds).toArray(),
      db.photos.where('powerTestId').anyOf(ptIds).toArray(),
    ])
    const photoIds = [...new Set(photoSets.flat().map((p) => p.id))]
    await db.photos.bulkDelete(photoIds)
    await db.photoBlobs.bulkDelete(photoIds)

    await db.dropCables.where('sourceBoxId').equals(id).delete()
    await db.powerTests.where('boxId').equals(id).delete()
    await db.fusions.where('boxId').equals(id).delete()
    await db.operations.where('boxId').equals(id).delete()
    await db.boxes.delete(id)
  })
}

// ---------- عملیات ----------
export type OperationInput = Omit<Operation, 'id' | 'createdAt' | 'updatedAt'>
export async function createOperation(input: OperationInput): Promise<Operation> {
  const t = nowMs()
  const rec: Operation = { ...input, id: uid(), createdAt: t, updatedAt: t }
  await db.operations.add(rec)
  return rec
}

export async function updateOperation(id: string, patch: Partial<Operation>): Promise<void> {
  await updateStrict(db.operations, id, { ...patch, updatedAt: nowMs() }, 'عملیات')
  // هم‌زمانی لینک عکس‌های این عملیات با والدین جدید
  if (patch.projectId !== undefined || patch.routeId !== undefined || patch.boxId !== undefined) {
    const photoPatch: Partial<Photo> = {}
    if (patch.projectId !== undefined) photoPatch.projectId = patch.projectId
    if (patch.routeId !== undefined) photoPatch.routeId = patch.routeId
    if (patch.boxId !== undefined) photoPatch.boxId = patch.boxId
    await db.photos.where('operationId').equals(id).modify(photoPatch)
  }
}

export async function deleteOperationCascade(id: string): Promise<void> {
  await db.transaction('rw', [db.operations, db.photos, db.photoBlobs], async () => {
    await deletePhotosByLink('operationId', id)
    await db.operations.delete(id)
  })
}

// ---------- فیوژن ----------
export type FusionInput = Omit<Fusion, 'id' | 'createdAt' | 'updatedAt'>
export async function createFusion(input: FusionInput): Promise<Fusion> {
  const t = nowMs()
  const rec: Fusion = { ...input, id: uid(), createdAt: t, updatedAt: t }
  await db.fusions.add(rec)
  return rec
}

export async function updateFusion(id: string, patch: Partial<Fusion>): Promise<void> {
  await updateStrict(db.fusions, id, { ...patch, updatedAt: nowMs() }, 'فیوژن')
  if (patch.projectId !== undefined || patch.routeId !== undefined || patch.boxId !== undefined) {
    const photoPatch: Partial<Photo> = {}
    if (patch.projectId !== undefined) photoPatch.projectId = patch.projectId
    if (patch.routeId !== undefined) photoPatch.routeId = patch.routeId
    if (patch.boxId !== undefined) photoPatch.boxId = patch.boxId
    await db.photos.where('fusionId').equals(id).modify(photoPatch)
  }
}

export async function deleteFusionCascade(id: string): Promise<void> {
  await db.transaction('rw', [db.fusions, db.photos, db.photoBlobs], async () => {
    await deletePhotosByLink('fusionId', id)
    await db.fusions.delete(id)
  })
}

// ---------- تست توان ----------
export type PowerTestInput = Omit<PowerTest, 'id' | 'createdAt' | 'updatedAt'>
export async function createPowerTest(input: PowerTestInput): Promise<PowerTest> {
  const t = nowMs()
  const rec: PowerTest = { ...input, id: uid(), createdAt: t, updatedAt: t }
  await db.powerTests.add(rec)
  return rec
}

export async function updatePowerTest(id: string, patch: Partial<PowerTest>): Promise<void> {
  await updateStrict(db.powerTests, id, { ...patch, updatedAt: nowMs() }, 'تست توان')
  if (patch.projectId !== undefined || patch.routeId !== undefined || patch.boxId !== undefined) {
    const photoPatch: Partial<Photo> = {}
    if (patch.projectId !== undefined) photoPatch.projectId = patch.projectId
    if (patch.routeId !== undefined) photoPatch.routeId = patch.routeId
    if (patch.boxId !== undefined) photoPatch.boxId = patch.boxId
    await db.photos.where('powerTestId').equals(id).modify(photoPatch)
  }
}

export async function deletePowerTestCascade(id: string): Promise<void> {
  await db.transaction('rw', [db.powerTests, db.photos, db.photoBlobs], async () => {
    await deletePhotosByLink('powerTestId', id)
    await db.powerTests.delete(id)
  })
}

// ---------- دراپ‌کابل ----------
export type DropCableInput = Omit<DropCable, 'id' | 'createdAt' | 'updatedAt'>
export async function createDropCable(input: DropCableInput): Promise<DropCable> {
  const t = nowMs()
  const rec: DropCable = { ...input, id: uid(), createdAt: t, updatedAt: t }
  await db.dropCables.add(rec)
  return rec
}

export async function updateDropCable(id: string, patch: Partial<DropCable>): Promise<void> {
  await updateStrict(db.dropCables, id, { ...patch, updatedAt: nowMs() }, 'دراپ‌کابل')
  if (patch.projectId !== undefined || patch.routeId !== undefined || patch.sourceBoxId !== undefined) {
    const photoPatch: Partial<Photo> = {}
    if (patch.projectId !== undefined) photoPatch.projectId = patch.projectId
    if (patch.routeId !== undefined) photoPatch.routeId = patch.routeId
    if (patch.sourceBoxId !== undefined) photoPatch.boxId = patch.sourceBoxId
    await db.photos.where('dropCableId').equals(id).modify(photoPatch)
  }
}

export async function deleteDropCableCascade(id: string): Promise<void> {
  await db.transaction('rw', [db.dropCables, db.photos, db.photoBlobs], async () => {
    await deletePhotosByLink('dropCableId', id)
    await db.dropCables.delete(id)
  })
}

// ---------- پروفایل ----------
export type ProfileInput = Omit<Profile, 'id' | 'createdAt' | 'updatedAt'>
export async function createProfile(input: ProfileInput): Promise<Profile> {
  const t = nowMs()
  const rec: Profile = { ...input, id: uid(), createdAt: t, updatedAt: t }
  await db.profiles.add(rec)
  return rec
}

export async function updateProfile(id: string, patch: Partial<Profile>): Promise<void> {
  await updateStrict(db.profiles, id, { ...patch, updatedAt: nowMs() }, 'پروفایل')
}

/**
 * حذف پروفایل — سوابق عملیات (اسنپ‌شات نام/نقش) دست‌نخورده می‌مانند.
 */
export async function deleteProfileSafe(id: string): Promise<void> {
  const exists = await db.profiles.get(id)
  if (!exists) throw new RecordNotFoundError('پروفایل')
  await db.profiles.delete(id)
}

/** اسنپ‌شات مسئول برای ثبت در عملیات/تست/دراپ‌کابل (تغییر پروفایل، سوابق قدیمی را تغییر نمی‌دهد) */
export function profileSnapshot(p: Profile, customRoleLabel?: string): { name: string; role: string; profileId: string } {
  const roleLabel =
    customRoleLabel ||
    (p.roles[0] === 'custom' ? p.customRoleLabel || 'سفارشی' : roleKeyLabel(p.roles[0]))
  return { name: `${p.firstName} ${p.lastName}`.trim(), role: roleLabel, profileId: p.id }
}

function roleKeyLabel(role?: string): string {
  const found = Object.entries(profileRoleLabels).find(([k]) => k === role)
  return found ? found[1] : role || '—'
}

// ---------- عکس ----------
/** ذخیره عکس: متادیتا در photos + blob در photoBlobs (در یک تراکنش) */
export async function savePhoto(
  link: PhotoLink,
  photo: Omit<Photo, 'id' | 'createdAt' | keyof PhotoLink> & { blob: Blob }
): Promise<Photo> {
  const { blob, ...meta } = photo
  const rec: Photo = { ...link, ...meta, id: uid(), createdAt: nowMs() }
  await db.transaction('rw', [db.photos, db.photoBlobs], async () => {
    await db.photos.add(rec)
    await db.photoBlobs.put({ id: rec.id, blob })
  })
  return rec
}

/** خواندن blob اصلی عکس (فقط برای پیش‌نمایش/PDF/پشتیبان — هرگز در لیست‌ها) */
export async function getPhotoBlob(photoId: string): Promise<Blob | undefined> {
  const row = await db.photoBlobs.get(photoId)
  return row?.blob
}

export async function updatePhotoMeta(
  id: string,
  patch: { title?: string; description?: string; category?: Photo['category'] }
): Promise<void> {
  await updateStrict(db.photos, id, patch, 'عکس')
}

/** حذف دسته‌ای عکس‌ها (متا + blob همیشه با هم) */
export async function deletePhotos(ids: string[]): Promise<void> {
  if (ids.length === 0) return
  await db.transaction('rw', [db.photos, db.photoBlobs], async () => {
    await db.photos.bulkDelete(ids)
    await db.photoBlobs.bulkDelete(ids)
  })
}

/** حذف عکس‌های متصل به یک لینک مشخص (داخل تراکنش والد) */
async function deletePhotosByLink(linkKey: keyof PhotoLink, linkValue: string): Promise<void> {
  const photos = await db.photos.where(linkKey).equals(linkValue).toArray()
  const ids = photos.map((p) => p.id)
  await db.photos.bulkDelete(ids)
  await db.photoBlobs.bulkDelete(ids)
}

export async function getProjectPhotoCount(projectId: string): Promise<number> {
  return db.photos.where('projectId').equals(projectId).count()
}

// ---------- آمار داشبورد (داده واقعی؛ بدون داده ساختگی) ----------
export interface DashboardStats {
  projectsTotal: number // غیرآرشیو
  projectsTotalAll: number // شامل آرشیو (برای تشخیص خالی‌بودن واقعی)
  projectsActive: number // در حال اجرا
  routes: number
  boxes: number
  operations: number
  operationsThisMonth: number // ماه شمسی جاری
  fusions: number
  powerTests: number
  dropCables: number
  consumedMetersTotal: number
  photoCount: number
  profiles: number
  /** عملیات ۶ ماه شمسی اخیر — برای نمودار داشبورد */
  operationsByMonth: Array<{ label: string; count: number }>
  /** توزیع وضعیت پروژه‌ها — برای نمودار داشبورد */
  projectStatusCounts: Array<{ status: ProjectStatus; count: number }>
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const [projectsTotal, projectsTotalAll, routes, boxes, operations, fusions, powerTests, dropCables, photoCount, profiles] =
    await Promise.all([
      db.projects.filter((p) => !p.archived).count(),
      db.projects.count(),
      db.routes.filter((r) => !r.archived).count(),
      db.boxes.filter((b) => !b.archived).count(),
      db.operations.count(),
      db.fusions.count(),
      db.powerTests.count(),
      db.dropCables.count(),
      db.photos.count(),
      db.profiles.count(),
    ])

  // ماه شمسی جاری (نه میلادی)
  const todayJ = isoToJalali(todayISO())!
  const monthWin = jalaliMonthWindow(todayJ.jy, todayJ.jm)
  const operationsThisMonth = await db.operations.filter((o) => o.createdAt >= monthWin.start && o.createdAt < monthWin.end).count()

  // ۶ ماه شمسی اخیر
  const operationsByMonth: Array<{ label: string; count: number }> = []
  {
    let jy = todayJ.jy
    let jm = todayJ.jm
    const windows: Array<{ label: string; start: number; end: number }> = []
    for (let i = 0; i < 6; i++) {
      const win = jalaliMonthWindow(jy, jm)
      windows.push({ label: jalaliMonthNames[jm - 1]!, start: win.start, end: win.end })
      jm--
      if (jm < 1) {
        jm = 12
        jy--
      }
    }
    windows.reverse()
    const counts = await Promise.all(
      windows.map((w) => db.operations.filter((o) => o.createdAt >= w.start && o.createdAt < w.end).count())
    )
    windows.forEach((w, i) => operationsByMonth.push({ label: w.label, count: counts[i] ?? 0 }))
  }

  // توزیع وضعیت پروژه‌ها (غیرآرشیو)
  const projects = await db.projects.filter((p) => !p.archived).toArray()
  const statusMap = new Map<ProjectStatus, number>()
  for (const p of projects) statusMap.set(p.status, (statusMap.get(p.status) ?? 0) + 1)
  const projectStatusCounts = [...statusMap.entries()].map(([status, count]) => ({ status, count }))

  // مجموع متراژ مصرفی — با cursor (بدون بارگذاری همه رکوردها در RAM)
  let consumedMetersTotal = 0
  await db.dropCables.each((c) => {
    const res: ConsumedResult = computeConsumed(c.initialMeters, c.returnedMeters, c.consumedUser)
    if (res.valid && res.value !== undefined) consumedMetersTotal += res.value
  })

  return {
    projectsTotal,
    projectsTotalAll,
    projectsActive: projects.filter((p) => p.status === 'in_progress').length,
    routes,
    boxes,
    operations,
    operationsThisMonth,
    fusions,
    powerTests,
    dropCables,
    consumedMetersTotal,
    photoCount,
    profiles,
    operationsByMonth,
    projectStatusCounts,
  }
}

/** آمار یک پروژه برای صفحه جزئیات */
export interface ProjectStats {
  routes: number
  boxes: number
  operations: number
  fusions: number
  powerTests: number
  dropCables: number
  photos: number
  consumedMeters: number
}

export async function getProjectStats(projectId: string): Promise<ProjectStats> {
  const [routes, boxes, operations, fusions, powerTests, dropCables, photos] = await Promise.all([
    db.routes.where('projectId').equals(projectId).filter((r) => !r.archived).count(),
    db.boxes.where('projectId').equals(projectId).filter((b) => !b.archived).count(),
    db.operations.where('projectId').equals(projectId).count(),
    db.fusions.where('projectId').equals(projectId).count(),
    db.powerTests.where('projectId').equals(projectId).count(),
    db.dropCables.where('projectId').equals(projectId).count(),
    db.photos.where('projectId').equals(projectId).count(),
  ])
  let consumedMeters = 0
  await db.dropCables
    .where('projectId')
    .equals(projectId)
    .each((c) => {
      const res = computeConsumed(c.initialMeters, c.returnedMeters, c.consumedUser)
      if (res.valid && res.value !== undefined) consumedMeters += res.value
    })
  return { routes, boxes, operations, fusions, powerTests, dropCables, photos, consumedMeters }
}

// ---------- پاک‌سازی کامل (برای حذف داده آزمایشی) ----------
export async function resetAllData(): Promise<void> {
  await db.transaction(
    'rw',
    [db.projects, db.routes, db.boxes, db.operations, db.fusions, db.powerTests, db.dropCables, db.profiles, db.photos, db.photoBlobs],
    async () => {
      await Promise.all([
        db.projects.clear(),
        db.routes.clear(),
        db.boxes.clear(),
        db.operations.clear(),
        db.fusions.clear(),
        db.powerTests.clear(),
        db.dropCables.clear(),
        db.profiles.clear(),
        db.photos.clear(),
        db.photoBlobs.clear(),
      ])
    }
  )
}
