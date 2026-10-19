// فایبرکار — پایگاه داده محلی (IndexedDB via Dexie)
// کاملاً آفلاین؛ هیچ داده‌ای به سرور ارسال نمی‌شود.
import Dexie, { type Table } from 'dexie'
import type {
  Box,
  ConsumedResult,
  DropCable,
  Fusion,
  LastBackupInfo,
  Operation,
  Photo,
  PhotoLink,
  PowerTest,
  Profile,
  Project,
  Route,
} from './types'
import { computeConsumed } from './persian'
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
  const rec: Project = { ...input, id: uid(), archived: 0, createdAt: t, updatedAt: t }
  await db.projects.add(rec)
  return rec
}

export async function updateProject(id: string, patch: Partial<Project>): Promise<void> {
  await db.projects.update(id, { ...patch, updatedAt: nowMs() })
}

export async function setProjectArchived(id: string, archived: 0 | 1): Promise<void> {
  await db.projects.update(id, { archived, updatedAt: nowMs() })
}

export async function deleteProjectCascade(id: string): Promise<void> {
  await db.transaction('rw', [db.projects, db.routes, db.boxes, db.operations, db.fusions, db.powerTests, db.dropCables, db.photos], async () => {
    const routeIds = (await db.routes.where('projectId').equals(id).toArray()).map((r) => r.id)
    const boxIds = (await db.boxes.where('projectId').equals(id).toArray()).map((b) => b.id)
    await db.photos.where('projectId').equals(id).delete()
    await db.dropCables.where('projectId').equals(id).delete()
    await db.powerTests.where('projectId').equals(id).delete()
    await db.fusions.where('projectId').equals(id).delete()
    await db.operations.where('projectId').equals(id).delete()
    await db.boxes.where('projectId').equals(id).delete()
    await db.routes.where('projectId').equals(id).delete()
    await db.projects.delete(id)
    void routeIds
    void boxIds
  })
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
  await db.routes.update(id, { ...patch, updatedAt: nowMs() })
}

export async function setRouteArchived(id: string, archived: 0 | 1): Promise<void> {
  await db.routes.update(id, { archived, updatedAt: nowMs() })
}

export async function deleteRouteCascade(id: string): Promise<void> {
  await db.transaction('rw', [db.routes, db.boxes, db.operations, db.fusions, db.powerTests, db.dropCables, db.photos], async () => {
    await db.photos.where('routeId').equals(id).delete()
    await db.dropCables.where('routeId').equals(id).delete()
    await db.powerTests.where('routeId').equals(id).delete()
    await db.fusions.where('routeId').equals(id).delete()
    await db.operations.where('routeId').equals(id).delete()
    await db.boxes.where('routeId').equals(id).delete()
    await db.routes.delete(id)
  })
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
  await db.boxes.update(id, { ...patch, updatedAt: nowMs() })
}

export async function setBoxArchived(id: string, archived: 0 | 1): Promise<void> {
  await db.boxes.update(id, { archived, updatedAt: nowMs() })
}

export async function deleteBoxCascade(id: string): Promise<void> {
  await db.transaction('rw', [db.boxes, db.operations, db.fusions, db.powerTests, db.dropCables, db.photos], async () => {
    await db.photos.where('boxId').equals(id).delete()
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
  await db.operations.update(id, { ...patch, updatedAt: nowMs() })
}

export async function deleteOperationCascade(id: string): Promise<void> {
  await db.transaction('rw', [db.operations, db.photos], async () => {
    await db.photos.where('operationId').equals(id).delete()
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
  await db.fusions.update(id, { ...patch, updatedAt: nowMs() })
}

export async function deleteFusionCascade(id: string): Promise<void> {
  await db.transaction('rw', [db.fusions, db.photos], async () => {
    await db.photos.where('fusionId').equals(id).delete()
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
  await db.powerTests.update(id, { ...patch, updatedAt: nowMs() })
}

export async function deletePowerTestCascade(id: string): Promise<void> {
  await db.transaction('rw', [db.powerTests, db.photos], async () => {
    await db.photos.where('powerTestId').equals(id).delete()
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
  await db.dropCables.update(id, { ...patch, updatedAt: nowMs() })
}

export async function deleteDropCableCascade(id: string): Promise<void> {
  await db.transaction('rw', [db.dropCables, db.photos], async () => {
    await db.photos.where('dropCableId').equals(id).delete()
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
  await db.profiles.update(id, { ...patch, updatedAt: nowMs() })
}

/**
 * حذف پروفایل — سوابق عملیات (اسنپ‌شات نام/نقش) دست‌نخورده می‌مانند.
 */
export async function deleteProfileSafe(id: string): Promise<void> {
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
export async function savePhoto(link: PhotoLink, photo: Omit<Photo, 'id' | 'createdAt' | keyof PhotoLink>): Promise<Photo> {
  const rec: Photo = { ...link, ...photo, id: uid(), createdAt: nowMs() }
  await db.photos.add(rec)
  return rec
}

export async function updatePhotoMeta(id: string, patch: { title?: string; description?: string; category?: Photo['category'] }): Promise<void> {
  await db.photos.update(id, patch)
}

export async function deletePhotos(ids: string[]): Promise<void> {
  await db.photos.bulkDelete(ids)
}

export async function getProjectPhotoCount(projectId: string): Promise<number> {
  return db.photos.where('projectId').equals(projectId).count()
}

// ---------- آمار داشبورد (داده واقعی؛ بدون داده ساختگی) ----------
export interface DashboardStats {
  projectsTotal: number
  projectsActive: number
  routes: number
  boxes: number
  operations: number
  operationsThisMonth: number
  fusions: number
  powerTests: number
  dropCables: number
  consumedMetersTotal: number
  photoCount: number
  profiles: number
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const [projectsTotal, projectsActive, routes, boxes, operations, fusions, powerTests, dropCables, photoCount, profiles] =
    await Promise.all([
      db.projects.filter((p) => !p.archived).count(),
      db.projects.filter((p) => !p.archived && p.status === 'in_progress').count(),
      db.routes.filter((r) => !r.archived).count(),
      db.boxes.filter((b) => !b.archived).count(),
      db.operations.count(),
      db.fusions.count(),
      db.powerTests.count(),
      db.dropCables.count(),
      db.photos.count(),
      db.profiles.count(),
    ])

  const monthStart = new Date()
  monthStart.setDate(1)
  monthStart.setHours(0, 0, 0, 0)
  const operationsThisMonth = await db.operations.filter((o) => o.createdAt >= monthStart.getTime()).count()

  const cables = await db.dropCables.toArray()
  let consumedMetersTotal = 0
  for (const c of cables) {
    const res: ConsumedResult = computeConsumed(c.initialMeters, c.returnedMeters, c.consumedUser)
    if (res.valid && res.value !== undefined) consumedMetersTotal += res.value
  }

  return {
    projectsTotal,
    projectsActive,
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
  const cables = await db.dropCables.where('projectId').equals(projectId).toArray()
  let consumedMeters = 0
  for (const c of cables) {
    const res = computeConsumed(c.initialMeters, c.returnedMeters, c.consumedUser)
    if (res.valid && res.value !== undefined) consumedMeters += res.value
  }
  return { routes, boxes, operations, fusions, powerTests, dropCables, photos, consumedMeters }
}

// ---------- پاک‌سازی کامل (برای حذف داده آزمایشی) ----------
export async function resetAllData(): Promise<void> {
  await db.transaction(
    'rw',
    [db.projects, db.routes, db.boxes, db.operations, db.fusions, db.powerTests, db.dropCables, db.profiles, db.photos, db.settings],
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
      ])
    }
  )
}
