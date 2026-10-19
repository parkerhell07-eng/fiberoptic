// فایبرکار — پشتیبان‌گیری و بازیابی کامل (پایگاه داده + عکس‌ها + ارتباط‌ها)
// فایل پشتیبان: JSON با نسخه‌بندی و checksum (SHA-256) برای بررسی سلامت.
import type { BackupTableName, LastBackupInfo, Photo } from './types'
import { BACKUP_TABLES } from './types'
import { db, getDb, resetAllData, setSetting } from './localdb'
import { blobToDataUrl, dataUrlToBlob } from './images'
import { isNativeApp, nativeSaveFile } from './native-bridge'

export const BACKUP_VERSION = 1
const CHECKSUM_KEY = '__checksum'

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

// ---------- ساخت پشتیبان ----------
export interface CreateBackupResult {
  blob: Blob
  info: LastBackupInfo
}

export async function createBackupBlob(): Promise<CreateBackupResult> {
  const tables: Record<string, unknown[]> = {}
  for (const name of BACKUP_TABLES) {
    const table = getDb().table(name)
    tables[name] = await table.toArray()
  }

  const payload: BackupPayload = {
    app: 'fiberkar',
    version: BACKUP_VERSION,
    createdAt: Date.now(),
    tables,
  }

  // عکس‌ها به dataURL تبدیل می‌شوند تا در فایل JSON قابل ذخیره باشند
  const photos = (tables.photos as Photo[]) || []
  const photosWithBlobs = await Promise.all(
    photos.map(async (p) => ({
      ...p,
      blob: await blobToDataUrl(p.blob),
    }))
  )
  payload.tables.photos = photosWithBlobs

  const json = JSON.stringify(payload)
  const checksum = await sha256Hex(json)
  const file: BackupFile = { ...payload, [CHECKSUM_KEY]: checksum }
  const blob = new Blob([JSON.stringify(file)], { type: 'application/json' })

  const counts: Record<string, number> = {}
  for (const name of BACKUP_TABLES) counts[name] = (tables[name] as unknown[]).length
  const info: LastBackupInfo = { time: payload.createdAt, size: blob.size, checksum, counts }
  await setSetting('lastBackup', info)

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

export async function verifyBackupBlob(blob: Blob): Promise<VerifyResult> {
  try {
    const text = await blob.text()
    let file: BackupFile
    try {
      file = JSON.parse(text) as BackupFile
    } catch {
      return { ok: false, error: 'فایل پشتیبان قابل خواندن نیست (JSON نامعتبر)' }
    }
    if (file.app !== 'fiberkar') return { ok: false, error: 'این فایل پشتیبان فیبرکار نیست' }
    if (!file.version) return { ok: false, error: 'نسخه فایل پشتیبان نامعتبر است' }
    if (file.version > BACKUP_VERSION)
      return { ok: false, error: `نسخه فایل (v${file.version}) جدیدتر از نسخه برنامه (v${BACKUP_VERSION}) است` }

    const { [CHECKSUM_KEY]: checksum, ...rest } = file
    const computed = await sha256Hex(JSON.stringify(rest))
    if (computed !== checksum) return { ok: false, error: 'فایل پشتیبان خراب یا دستکاری‌شده است (عدم تطابق checksum)' }

    const counts: Record<string, number> = {}
    for (const name of BACKUP_TABLES) counts[name] = ((rest.tables?.[name] as unknown[]) ?? []).length
    return { ok: true, version: file.version, createdAt: file.createdAt, counts }
  } catch (e) {
    return { ok: false, error: `بررسی فایل ممکن نشد: ${(e as Error).message}` }
  }
}

// ---------- بازیابی ----------
export interface RestoreResult {
  restored: Record<string, number>
  skipped: Record<string, number>
  mode: 'replace' | 'merge'
}

/**
 * بازیابی پشتیبان.
 * mode 'replace': پاک‌سازی کامل داده‌های فعلی و جایگزینی (پیش از فراخوانی باید کاربر هشدار را تأیید کند)
 * mode 'merge': افزودن رکوردهایی که شناسه تکراری ندارند (بدون جایگزینی کامل)
 */
export async function restoreBackup(blob: Blob, mode: 'replace' | 'merge'): Promise<RestoreResult> {
  const verify = await verifyBackupBlob(blob)
  if (!verify.ok) throw new Error(verify.error || 'فایل پشتیبان معتبر نیست')

  const file = JSON.parse(await blob.text()) as BackupFile
  const restored: Record<string, number> = {}
  const skipped: Record<string, number> = {}

  if (mode === 'replace') {
    await resetAllData()
  }

  for (const name of BACKUP_TABLES) {
    const rows = (file.tables?.[name] as unknown[]) ?? []
    let okCount = 0
    let skipCount = 0

    const prepared: unknown[] = []
    if (name === 'photos') {
      for (const raw of rows as Photo[]) {
        try {
          prepared.push({ ...raw, blob: await dataUrlToBlob(raw.blob as unknown as string) })
        } catch {
          skipCount++ // عکس خراب؛ رکورد بدون عکس ثبت نمی‌شود تا «فایل بی‌صاحب» ایجاد نشود
        }
      }
    } else {
      prepared.push(...rows)
    }

    const table = getDb().table(name)
    if (mode === 'merge') {
      const existing = new Set((await table.toArray()).map((r: { id?: string }) => r.id))
      const toAdd = prepared.filter((r) => {
        const id = (r as { id?: string }).id
        if (id && existing.has(id)) {
          skipCount++
          return false
        }
        return true
      })
      await table.bulkAdd(toAdd)
      okCount = toAdd.length
    } else {
      await table.bulkAdd(prepared)
      okCount = prepared.length
    }
    restored[name] = okCount
    skipped[name] = skipCount
  }

  await setSetting('lastRestore', { time: Date.now(), mode, restored, skipped })
  return { restored, skipped, mode }
}

// ---------- ذخیره فایل در محل انتخابی کاربر ----------
export async function saveBlobToDisk(
  blob: Blob,
  suggestedName: string
): Promise<'picker' | 'download'> {
  // داخل اپ اندروید (APK): ذخیره مستقیم در پوشه اسناد دستگاه
  if (isNativeApp()) {
    await nativeSaveFile(blob, suggestedName)
    return 'download'
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

// خاموش کردن lint برای استفاده مستقیم db در این ماژول
void db
