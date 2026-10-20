'use client'

// فایبرکار — دکمه مشترک خروجی CSV (ساخت فایل + ذخیره/اشتراک + اعلان‌های فارسی)
// در هر نمای لیست (عملیات/دراپ‌کابل/تست توان/جزئیات پروژه) با projectId یا بدون آن استفاده می‌شود.
import * as React from 'react'
import { Download, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { exportConsumablesCsv, exportDropCablesCsv, exportOperationsCsv, exportPowerTestsCsv, type CsvKind } from '@/lib/csv'
import { saveBlobToDisk } from '@/lib/backup'
import { sanitizeFileName } from '@/lib/native-bridge'
import { todayISO } from '@/lib/persian'

export type { CsvKind }

/** ساخت CSV، ذخیره در دستگاه/اشتراک و اعلان نتیجه — مشترک بین دکمه و منوها */
export async function buildAndSaveCsv(kind: CsvKind, projectId?: string): Promise<void> {
  const blob =
    kind === 'operations'
      ? await exportOperationsCsv(projectId)
      : kind === 'drop-cables'
        ? await exportDropCablesCsv(projectId)
        : kind === 'consumables'
          ? await exportConsumablesCsv(projectId)
          : await exportPowerTestsCsv(projectId)
  const name = sanitizeFileName(`fiberkar-${kind}${projectId ? '' : '-همه'}-${todayISO()}.csv`, '.csv')
  const how = await saveBlobToDisk(blob, name)
  if (how === 'shared') {
    toast.success('فایل برای اشتراک آماده شد', { description: name })
  } else {
    toast.success('فایل CSV ساخته شد', {
      description: `${name} — ${how === 'picker' ? 'در محل انتخابی شما ذخیره شد' : 'در حافظه دستگاه ذخیره شد'}`,
    })
  }
}

export interface CsvExportButtonProps {
  kind: CsvKind
  projectId?: string
  disabled?: boolean
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link'
  size?: 'default' | 'sm' | 'lg' | 'icon'
  className?: string
  label?: string
  title?: string
}

export function CsvExportButton({
  kind,
  projectId,
  disabled,
  variant = 'outline',
  size,
  className,
  label = 'خروجی CSV',
  title,
}: CsvExportButtonProps) {
  const [busy, setBusy] = React.useState(false)

  async function handleClick() {
    setBusy(true)
    try {
      await buildAndSaveCsv(kind, projectId)
    } catch (e) {
      if ((e as Error)?.name === 'AbortError') {
        toast.info('ذخیره فایل لغو شد', {
          description: 'فایل CSV ساخته شد اما محل ذخیره انتخاب نشد؛ می‌توانید دوباره تلاش کنید',
        })
      } else {
        toast.error('ساخت فایل CSV ناموفق بود', {
          description: (e as Error)?.message || 'خطای ناشناخته',
        })
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      className={className}
      disabled={disabled || busy}
      title={title ?? `دانلود فایل ${label}`}
      onClick={() => void handleClick()}
    >
      {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Download className="size-4" aria-hidden />}
      {busy ? 'در حال ساخت…' : label}
    </Button>
  )
}
