'use client'

// فایبرکار — گالری عکس با پیش‌نمایش، بزرگ‌نمایی، ویرایش، حذف و انتخاب برای گزارش
import * as React from 'react'
import { ChevronLeft, ChevronRight, Loader2, Trash2, ZoomIn, ZoomOut } from 'lucide-react'
import { toast } from 'sonner'
import { useLiveQuery } from 'dexie-react-hooks'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ConfirmDialog } from './primitives'
import { PhotoPickerButton } from './photo-picker'
import { deletePhotos, db, updatePhotoMeta } from '@/lib/localdb'
import { formatBytes, formatJalaliDateTime } from '@/lib/persian'
import { messages, photoCategoryLabels } from '@/lib/labels'
import type { Photo as PhotoEntity, PhotoCategory, PhotoLink } from '@/lib/types'

export interface PhotoGalleryFilter extends PhotoLink {
  category?: PhotoCategory
}

function ThumbImage({ photoId, alt }: { photoId: string; alt: string }) {
  const url = useLiveQuery(async () => {
    const p = await db.photos.get(photoId)
    return p ? URL.createObjectURL(p.blob) : undefined
  }, [photoId])
  React.useEffect(() => {
    return () => {
      if (url) URL.revokeObjectURL(url)
    }
  }, [url])
  if (!url) return <div className="aspect-square w-full animate-pulse rounded-lg bg-muted" />
  return <img src={url} alt={alt} className="aspect-square w-full rounded-lg object-cover" loading="lazy" />
}

export function PhotoGallery({
  filter,
  selectable = false,
  selectedIds,
  onSelectionChange,
  onCountChange,
  emptyHint = 'عکسی ثبت نشده است.',
}: {
  filter: PhotoGalleryFilter
  selectable?: boolean
  selectedIds?: string[]
  onSelectionChange?: (ids: string[]) => void
  onCountChange?: (count: number) => void
  emptyHint?: string
}) {
  const photos = useLiveQuery(async () => {
    let col = db.photos.orderBy('createdAt').reverse()
    if (filter.projectId) col = col.filter((p) => p.projectId === filter.projectId)
    if (filter.routeId) col = col.filter((p) => p.routeId === filter.routeId)
    if (filter.boxId) col = col.filter((p) => p.boxId === filter.boxId)
    if (filter.operationId) col = col.filter((p) => p.operationId === filter.operationId)
    if (filter.fusionId) col = col.filter((p) => p.fusionId === filter.fusionId)
    if (filter.powerTestId) col = col.filter((p) => p.powerTestId === filter.powerTestId)
    if (filter.dropCableId) col = col.filter((p) => p.dropCableId === filter.dropCableId)
    if (filter.category) col = col.filter((p) => p.category === filter.category)
    return col.toArray()
  }, [JSON.stringify(filter)])

  React.useEffect(() => {
    if (photos) onCountChange?.(photos.length)
  }, [photos, onCountChange])

  const [previewId, setPreviewId] = React.useState<string | null>(null)
  const [deleteId, setDeleteId] = React.useState<string | null>(null)
  const [editId, setEditId] = React.useState<string | null>(null)

  const previewPhoto = useLiveQuery(() => (previewId ? db.photos.get(previewId) : undefined), [previewId])

  if (photos === undefined) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }
  if (photos.length === 0) {
    return <div className="rounded-xl border border-dashed py-10 text-center text-sm text-muted-foreground">{emptyHint}</div>
  }

  return (
    <>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
        {photos.map((p) => {
          const checked = selectedIds?.includes(p.id) ?? false
          return (
            <div key={p.id} className="group relative overflow-hidden rounded-lg border bg-card">
              <button
                type="button"
                className="block w-full cursor-zoom-in"
                onClick={() => (selectable ? toggleSelect(p.id) : setPreviewId(p.id))}
                aria-label={`مشاهده ${p.title}`}
              >
                <ThumbImage photoId={p.id} alt={p.title} />
              </button>
              <div className="p-1.5">
                <p className="truncate text-[11px] font-medium" title={p.title}>
                  {p.title}
                </p>
                <p className="text-[10px] text-muted-foreground">{photoCategoryLabels[p.category]}</p>
              </div>
              {selectable && (
                <div className="absolute right-1.5 top-1.5 rounded-md bg-background/80 p-0.5">
                  <Checkbox checked={checked} onCheckedChange={() => toggleSelect(p.id)} aria-label={`انتخاب ${p.title}`} />
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* پیش‌نمایش با بزرگ‌نمایی */}
      <Dialog open={!!previewId} onOpenChange={(o) => !o && setPreviewId(null)}>
        <DialogContent className="max-w-2xl p-3" dir="rtl">
          {previewPhoto && <PreviewBody photo={previewPhoto} />}
        </DialogContent>
      </Dialog>

      {/* ویرایش عنوان/توضیح */}
      <EditDialog photoId={editId} onClose={() => setEditId(null)} />

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(o) => !o && setDeleteId(null)}
        title="حذف عکس"
        description="این عکس به‌طور کامل حذف می‌شود و قابل بازگشت نیست."
        confirmLabel="حذف"
        destructive
        onConfirm={async () => {
          if (!deleteId) return
          await deletePhotos([deleteId])
          setDeleteId(null)
          toast.success(messages.photoDeleted)
        }}
      />
    </>
  )

  function toggleSelect(id: string) {
    if (!onSelectionChange || !selectedIds) return
    if (selectedIds.includes(id)) onSelectionChange(selectedIds.filter((x) => x !== id))
    else onSelectionChange([...selectedIds, id])
  }

  function PreviewBody({ photo }: { photo: PhotoEntity }) {
    const [url, setUrl] = React.useState<string | null>(null)
    const [zoom, setZoom] = React.useState(1)
    React.useEffect(() => {
      const u = URL.createObjectURL(photo.blob)
      setUrl(u)
      return () => URL.revokeObjectURL(u)
    }, [photo])
    React.useEffect(() => {
      const onWheel = (e: WheelEvent) => {
        if (e.ctrlKey) {
          e.preventDefault()
          setZoom((z) => Math.min(4, Math.max(0.5, z + (e.deltaY > 0 ? -0.15 : 0.15))))
        }
      }
      window.addEventListener('wheel', onWheel, { passive: false })
      return () => window.removeEventListener('wheel', onWheel)
    }, [])
    return (
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <DialogTitle className="text-base">{photo.title}</DialogTitle>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" aria-label="کوچک‌نمایی" onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}>
              <ZoomOut className="size-4" />
            </Button>
            <span className="w-10 text-center text-xs tabular-nums">{Math.round(zoom * 100)}٪</span>
            <Button variant="ghost" size="icon" aria-label="بزرگ‌نمایی" onClick={() => setZoom((z) => Math.min(4, z + 0.25))}>
              <ZoomIn className="size-4" />
            </Button>
          </div>
        </div>
        <div className="max-h-[60vh] overflow-auto rounded-lg bg-muted/40">
          {url && (
            <img
              src={url}
              alt={photo.title}
              className="mx-auto block origin-top transition-transform"
              style={{ transform: `scale(${zoom})`, maxHeight: '60vh', maxWidth: '100%' }}
            />
          )}
        </div>
        <DialogDescription className="space-y-1 text-xs">
          <span className="block">
            دسته: {photoCategoryLabels[photo.category]} • {formatBytes(photo.size)} • {photo.width}×{photo.height}
          </span>
          <span className="block">زمان ثبت: {formatJalaliDateTime(photo.createdAt)}</span>
          {photo.description && <span className="block">{photo.description}</span>}
        </DialogDescription>
        <DialogFooter className="flex-row justify-start gap-2">
          <Button variant="outline" className="min-h-11 flex-1" onClick={() => setEditId(photo.id)}>
            ویرایش عنوان/توضیح
          </Button>
          <Button variant="destructive" className="min-h-11 flex-1" onClick={() => setDeleteId(photo.id)}>
            <Trash2 className="size-4" />
            حذف
          </Button>
        </DialogFooter>
      </div>
    )
  }
}

function EditDialog({ photoId, onClose }: { photoId: string | null; onClose: () => void }) {
  const photo = useLiveQuery(() => (photoId ? db.photos.get(photoId) : undefined), [photoId])
  const [title, setTitle] = React.useState('')
  const [description, setDescription] = React.useState('')
  const [category, setCategory] = React.useState<PhotoCategory>('project')

  React.useEffect(() => {
    if (photo) {
      setTitle(photo.title)
      setDescription(photo.description)
      setCategory(photo.category)
    }
  }, [photo])

  return (
    <Dialog open={!!photoId} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle>ویرایش عکس</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label>عنوان</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} className="min-h-11" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>دسته‌بندی</Label>
            <Select value={category} onValueChange={(v) => setCategory(v as PhotoCategory)}>
              <SelectTrigger className="min-h-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent dir="rtl">
                {Object.entries(photoCategoryLabels).map(([k, v]) => (
                  <SelectItem key={k} value={k}>
                    {v}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>توضیح</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
          </div>
        </div>
        <DialogFooter className="flex-row justify-start gap-2">
          <Button
            className="min-h-11 flex-1"
            onClick={async () => {
              if (!photoId) return
              await updatePhotoMeta(photoId, { title: title.trim() || photo?.title || 'بدون عنوان', description: description.trim(), category })
              onClose()
              toast.success(messages.updated)
            }}
          >
            ذخیره
          </Button>
          <Button variant="outline" className="min-h-11 flex-1" onClick={onClose}>
            انصراف
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
