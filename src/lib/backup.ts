// فایبرکار — پشتیبان‌گیری و بازیابی کامل (پایگاه داده + عکس‌ها + ارتباط‌ها)
// فایل پشتیبان: JSON با نسخه‌بندی و checksum (SHA-256) برای بررسی سلامت.
//
// v1.1:
//  - بازیابی «جایگزینی کامل» اتمی است: همه‌چیز داخل یک تراکنش Dexie —
//    اگر وسط کار خطایی رخ دهد، داده‌های قبلی دست‌نخورده برمی‌گردند.
//  - ساخت پشتیبان با حافظه بهینه (استخر محدود برای تبدیل عکس‌ها، stringify یک‌باره)
//  - پشتیبانی از قالب قدیمی (blob داخل رکورد عکس) و قالب جدید (photoBlobs)
//  - گزارش پیشرفت مرحله‌به‌مرحله برای UI
import type { BackupTableName, LastBackupInfo, Photo, PhotoBlobRow } from './types'
import { BACKUP_TABLES } from './types'
import { db, getDb, setSetting } from './localdb'
import { blobToDataUrl, dataUrlToBlob } from './images'
import { isNativeApp, nativeSaveFile, nativeShareOrSaveFile } from './native-bridge'

export const BACKUP_VERSION = 1
const CHECKSUM_KEY = '__checksum'

const ALL_TABLES = [...BACKUP_TABLES] as const

interface BackupPayload {
  app: 'fiberkar'
  version: number
  createdAt: number
  tables: Record<string, unknown[]>
}

interface BackupFile extends BackupPayload {
  [CHECKSUM_KEY]: string
}

async function sha256Hex(text: string): Promise<string> {
  if (typeof crypto === 'undefined' || !crypto.subtle) {
    // fallback ساده (فقط برای محیط‌های بسیار قدیمی)
    let h = 0
    for (let i = 0; i < text.length; i++) {
      h = (h * 31 + text.charCodeAt(i)) | 0
    }
    return `weak-${h >>> 0}`
  }
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/** اجرای کارها با هم‌زمانی محدود (کنترل حافظه برای تبدیل عکس‌ها) */
async function mapPool<T, R>(items: T[], poolSize: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length)
  let next = 0
  const workers = Array.from({ length: Math.min(poolSize, items.length) }, async () => {
    while (true) {
      const i = next++
      if (i >= items.length) return
      results[i] = await fn(items[i]!, i)
    }
  })
  await Promise.all(workers)
  return results
}

// ---------- ساخت پشتیبان ----------
export interface CreateBackupResult {
  blob: Blob
  info: LastBackupInfo
}

export type BackupPhase = 'read' | 'photos' | 'finalize'

export async function createBackupBlob(
  onProgress?: (phase: BackupPhase, done: number, total: number) => void
): Promise<CreateBackupResult> {
  onProgress?.('read', 0, ALL_TABLES.length)
  const tables: Record<string, unknown[]> = {}
  let step = 0
  for (const name of ALL_TABLES) {
    const table = getDb().table(name)
    tables[name] = await table.toArray()
    step++
    onProgress?.('read', step, ALL_TABLES.length)
  }

  // عکس‌ها: blob → dataURL با استخر محدود (حافظه امن روی دستگاه‌های ضعیف)
  const photos = (tables.photos as Photo[]) ?? []
  const blobRows = (tables.photoBlobs as PhotoBlobRow[]) ?? []
  const blobById = new Map(blobRows.map((r) => [r.id, r.blob]))

  onProgress?.('photos', 0, photos.length)
  let photoDone = 0
  const photosWithBlobs = await mapPool(photos, 4, async (p) => {
    const blob = blobById.get(p.id)
    let dataUrl = ''
    if (blob) {
      try {
        dataUrl = await blobToDataUrl(blob)
      } catch {
        dataUrl = '' // عکس خوانده نشد — رکورد بدون تصویر در پشتیبان می‌آید
      }
    }
    photoDone++
    onProgress?.('photos', photoDone, photos.length)
    const { ...rest } = p as Photo & { blob?: unknown }
    delete rest.blob // اگر به هر دلیل blob در رکورد بود، در JSON نمی‌رود
    return dataUrl ? { ...rest, blob: dataUrl } : { ...rest }
  })
  tables.photos = photosWithBlobs
  tables.photoBlobs = [] // blobها داخل رکورد عکس با dataURL ذخیره شده‌اند

  onProgress?.('finalize', 0, 1)
  const payload: BackupPayload = {
    app: 'fiberkar',
    version: BACKUP_VERSION,
    createdAt: Date.now(),
    tables,
  }

  // فقط یک stringify — checksum روی همان رشته و درج checksum بدون ساخت رشته دوم
  const json = JSON.stringify(payload)
  const checksum = await sha256Hex(json)
  const fileJson = `${json.slice(0, -1)},"${CHECKSUM_KEY}":"${checksum}"}`
  const blob = new Blob([fileJson], { type: 'application/json' })

  const counts: Record<string, number> = {}
  for (const name of ALL_TABLES) counts[name] = (tables[name] as unknown[]).length
  delete counts.photoBlobs // داخل رکورد عکس‌هاست
  const info: LastBackupInfo = { time: payload.createdAt, size: blob.size, checksum, counts }
  await setSetting('lastBackup', info)

  onProgress?.('finalize', 1, 1)
  return { blob, info }
}

// ---------- بررسی سلامت ----------
export interface VerifyResult {
  ok: boolean
  version?: number
  createdAt?: number
  counts?: Record<string, number>
  error?: string
}

/** بررسی + پارس یک‌باره (جلوگیری از دو بار خواندن/پارس فایل‌های بزرگ) */
export async function verifyAndParseBackupBlob(blob: Blob): Promise<{ verify: VerifyResult; file?: BackupFile }> {
  try {
    const text = await blob.text()
    let file: BackupFile
    try {
      file = JSON.parse(text) as BackupFile
    } catch {
      return { verify: { ok: false, error: 'فایل پشتیبان قابل خواندن نیست (JSON نامعتبر)' } }
    }
    if (file.app !== 'fiberkar') return { verify: { ok: false, error: 'این فایل پشتیبان فیبرکار نیست' } }
    if (!file.version) return { verify: { ok: false, error: 'نسخه فایل پشتیبان نامعتبر است' } }
    if (file.version > BACKUP_VERSION)
      return { verify: { ok: false, error: `نسخه فایل (v${file.version}) جدیدتر از نسخه برنامه (v${BACKUP_VERSION}) است` } }

    const { [CHECKSUM_KEY]: checksum, ...rest } = file
    const computed = await sha256Hex(JSON.stringify(rest))
    if (computed !== checksum)
      return { verify: { ok: false, error: 'فایل پشتیبان خراب یا دستکاری‌شده است (عدم تطابق checksum)' } }

    const counts: Record<string, number> = {}
    for (const name of ALL_TABLES) counts[name] = ((rest.tables?.[name] as unknown[]) ?? []).length
    return { verify: { ok: true, version: file.version, createdAt: file.createdAt, counts }, file }
  } catch (e) {
    return { verify: { ok: false, error: `بررسی فایل ممکن نشد: ${(e as Error).message}` } }
  }
}

export async function verifyBackupBlob(blob: Blob): Promise<VerifyResult> {
  const { verify } = await verifyAndParseBackupBlob(blob)
  return verify
}

// ---------- بازیابی ----------
export interface RestoreResult {
  restored: Record<string, number>
  skipped: Record<string, number>
  mode: 'replace' | 'merge'
}

export type RestorePhase = 'validate' | 'photos' | 'write'

/**
 * بازیابی پشتیبان (اتمی).
 * mode 'replace': پاک‌سازی کامل داده‌های فعلی و جایگزینی — همه داخل یک تراکنش؛
 *   اگر خطایی رخ دهد، هیچ‌چیز تغییر نمی‌کند.
 * mode 'merge': افزودن رکوردهایی که شناسه تکراری ندارند — همین‌طور اتمی.
 */
export async function restoreBackup(
  blob: Blob,
  mode: 'replace' | 'merge',
  onProgress?: (phase: RestorePhase, done: number, total: number) => void
): Promise<RestoreResult> {
  onProgress?.('validate', 0, 1)
  const { verify, file } = await verifyAndParseBackupBlob(blob)
  if (!verify.ok) throw new Error(verify.error || 'فایل پشتیبان معتبر نیست')
  if (!file) throw new Error('فایل پشتیبان قابل خواندن نیست')
  onProgress?.('validate', 1, 1)

  const restored: Record<string, number> = {}
  const skipped: Record<string, number> = {}

  // ۱) آماده‌سازی رکورد عکس‌ها بیرون از تراکنش (dataURL → Blob با استخر محدود)
  onProgress?.('photos', 0, 1)
  const preparedPhotos: Photo[] = []
  const preparedBlobRows: PhotoBlobRow[] = []
  let photoSkipped = 0

  const legacyPhotos = ((file.tables?.photos as unknown[]) ?? []) as Array<Photo & { blob?: string | Blob }>
  const backupBlobRows = ((file.tables?.photoBlobs as unknown[]) ?? []) as Array<PhotoBlobRow & { blob?: string }>
  // قالب قدیمی: blob به‌صورت dataURL داخل رکورد عکس
  const photoDataUrls = new Map<string, string | Blob>()
  for (const p of legacyPhotos) {
    if (typeof p?.id === 'string' && p.blob) photoDataUrls.set(p.id, p.blob)
  }
  // قالب جدید: ردیف‌های photoBlobs با dataURL
  for (const row of backupBlobRows) {
    if (typeof row?.id === 'string' && row.blob && !photoDataUrls.has(row.id)) {
      photoDataUrls.set(row.id, row.blob)
    }
  }
  const idsToConvert = [...photoDataUrls.keys()]
  const converted = new Map<string, Blob>()
  let done = 0
  await mapPool(idsToConvert, 4, async (id) => {
    const src = photoDataUrls.get(id)
    if (typeof src !== 'string') return
    try {
      converted.set(id, await dataUrlToBlob(src))
    } catch {
      /* عکس خراب — در ادامه رکورد بدون blob یا حذف می‌شود */
    }
    done++
    onProgress?.('photos', done, idsToConvert.length)
  })

  for (const p of legacyPhotos) {
    if (typeof p?.id !== 'string' || !p.id) {
      photoSkipped++
      continue
    }
    const { blob: _removed, ...meta } = p
    const b = converted.get(p.id)
    if (b) {
      preparedPhotos.push(meta as Photo)
      preparedBlobRows.push({ id: p.id, blob: b })
    } else if (photoDataUrls.has(p.id)) {
      photoSkipped++ // عکس بدون blob قابل بازیابی — رکورد کامل ناقص می‌ماند؛ ثبت نمی‌شود
    } else {
      // عکس اصلان blob نداشته (نادر) — متا ثبت می‌شود تا اشاره‌گر از دست نرود
      preparedPhotos.push({ ...(meta as Photo), thumb: meta.thumb ?? '' })
    }
  }
  onProgress?.('photos', idsToConvert.length, idsToConvert.length)

  // ۲) نوشتن اتمی همه جدول‌ها در یک تراکنش
  onProgress?.('write', 0, ALL_TABLES.length)
  await db.transaction('rw', ALL_TABLES.map((n) => getDb().table(n)), async () => {
    if (mode === 'replace') {
      for (const name of ALL_TABLES) await getDb().table(name).clear()
    }
    let wstep = 0
    for (const name of ALL_TABLES) {
      const table = getDb().table(name)
      let rows: unknown[] = []
      let skipCount = 0

      if (name === 'photos') {
        rows = preparedPhotos
      } else if (name === 'photoBlobs') {
        rows = preparedBlobRows
        skipCount = photoSkipped
      } else {
        const raw = (file.tables?.[name] as unknown[]) ?? []
        if (mode === 'merge') {
          const existing = new Set(((await table.toArray()) as Array<{ id?: string }>).map((r) => r.id))
          for (const r of raw) {
            const id = (r as { id?: string })?.id
            if (typeof id === 'string' && id && !existing.has(id)) rows.push(r)
            else skipCount++
          }
        } else {
          // فقط رکوردهای دارای شناسه معتبر
          for (const r of raw) {
            const id = (r as { id?: string })?.id
            if (typeof id === 'string' && id) rows.push(r)
            else skipCount++
          }
        }
      }

      if (rows.length > 0) await table.bulkPut(rows)
      restored[name] = rows.length
      skipped[name] = skipCount
      wstep++
      onProgress?.('write', wstep, ALL_TABLES.length)
    }
  })

  await setSetting('lastRestore', { time: Date.now(), mode, restored, skipped })
  return { restored, skipped, mode }
}

// ---------- ذخیره فایل در محل انتخابی کاربر ----------
export async function saveBlobToDisk(
  blob: Blob,
  suggestedName: string
): Promise<'picker' | 'download' | 'shared'> {
  // داخل اپ اندروید (APK): اول تلاش برای ذخیره در اسناد؛ در خطا مسیر اشتراک (همیشه کار می‌کند)
  if (isNativeApp()) {
    try {
      await nativeSaveFile(blob, suggestedName)
      return 'download'
    } catch {
      const result = await nativeShareOrSaveFile(blob, suggestedName)
      if (result === 'failed') {
        throw new Error('ذخیره فایل ممکن نشد؛ اشتراک‌گذاری هم ناموفق بود')
      }
      return 'shared'
    }
  }
  type PickerWindow = Window & {
    showSaveFilePicker?: (opts?: { suggestedName?: string; types?: Array<{ description: string; accept: Record<string, string[]> }> }) => Promise<{
      createWritable: () => Promise<{ write: (data: Blob) => Promise<void>; close: () => Promise<void> }>
    }>
  }
  const w = window as PickerWindow
  if (typeof w.showSaveFilePicker === 'function') {
    try {
      const handle = await w.showSaveFilePicker({
        suggestedName,
        types: [{ description: 'فایل پشتیبان فیبرکار', accept: { 'application/json': ['.json'] } }],
      })
      const writable = await handle.createWritable()
      await writable.write(blob)
      await writable.close()
      return 'picker'
    } catch (e) {
      if ((e as Error)?.name === 'AbortError') throw e
      // ادامه با دانلود معمولی
    }
  }
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = suggestedName
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10000)
  return 'download'
}

/** نام پیشنهادی فایل پشتیبان */
export function backupFileName(): string {
  const d = new Date()
  const p = (x: number) => String(x).padStart(2, '0')
  return `fiberkar-backup-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}.json`
}
