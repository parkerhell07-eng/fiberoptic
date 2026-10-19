'use client'

// فایبرکار — ثبت عکس با دوربین یا انتخاب از گالری دستگاه
// عکس‌ها در فضای اختصاصی اپ (IndexedDB) ذخیره می‌شوند و در گالری عمومی گوشی ظاهر نمی‌شوند.
import * as React from 'react'
import { Camera, ImagePlus, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { processImageFile } from '@/lib/images'
import { savePhoto } from '@/lib/localdb'
import { messages } from '@/lib/labels'
import type { Photo, PhotoCategory, PhotoLink } from '@/lib/types'

export function PhotoPickerButton({
  link,
  category,
  baseTitle,
  label = 'افزودن عکس',
  variant = 'outline',
  size = 'default',
  maxCount,
  onSaved,
  disabled,
}: {
  link: PhotoLink
  category: PhotoCategory
  baseTitle?: string
  label?: string
  variant?: 'default' | 'outline' | 'ghost' | 'secondary' | 'destructive' | 'link'
  size?: 'default' | 'sm' | 'icon'
  maxCount?: number
  onSaved?: (photos: Photo[]) => void
  disabled?: boolean
}) {
  const cameraRef = React.useRef<HTMLInputElement>(null)
  const pickerRef = React.useRef<HTMLInputElement>(null)
  const [busy, setBusy] = React.useState(false)

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    setBusy(true)
    const saved: Photo[] = []
    try {
      for (const file of Array.from(files)) {
        if (!file.type.startsWith('image/')) continue
        const processed = await processImageFile(file)
        const title = `${baseTitle ? baseTitle + ' ' : ''}${new Date().toLocaleString('fa-IR')}`
        try {
          const rec = await savePhoto(link, {
            category,
            title,
            description: '',
            blob: processed.blob,
            thumb: processed.thumb,
            width: processed.width,
            height: processed.height,
            size: processed.blob.size,
            mime: processed.blob.type,
          })
          saved.push(rec)
        } catch (e) {
          if ((e as Error)?.name === 'QuotaExceededError') toast.error(messages.storageFull)
          else toast.error(messages.error)
        }
      }
      if (saved.length > 0) toast.success(`${messages.photoSaved} (${saved.length})`)
      onSaved?.(saved)
    } finally {
      setBusy(false)
      if (cameraRef.current) cameraRef.current.value = ''
      if (pickerRef.current) pickerRef.current.value = ''
    }
  }

  return (
    <>
      <DropdownMenu dir="rtl">
        <DropdownMenuTrigger asChild>
          <Button variant={variant} size={size} disabled={disabled || busy} className="min-h-11">
            {busy ? <Loader2 className="size-4 animate-spin" /> : <ImagePlus className="size-4" />}
            {size !== 'icon' && label}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem onClick={() => cameraRef.current?.click()}>
            <Camera className="size-4" />
            گرفتن عکس با دوربین
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => pickerRef.current?.click()}>
            <ImagePlus className="size-4" />
            انتخاب از گالری دستگاه
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        aria-hidden
        onChange={(e) => handleFiles(e.target.files)}
      />
      <input
        ref={pickerRef}
        type="file"
        accept="image/*"
        multiple={maxCount === undefined || maxCount > 1}
        className="hidden"
        aria-hidden
        onChange={(e) => handleFiles(e.target.files)}
      />
    </>
  )
}
