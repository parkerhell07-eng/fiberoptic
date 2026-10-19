'use client'

// فایبرکار — گالری سراسری عکس‌ها: فیلتر پروژه/دسته، مرتب‌سازی، آمار حجم و ثبت عکس جدید
import * as React from 'react'
import { Image as ImageIcon, ImagePlus, Loader2 } from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { PhotoGallery } from './photo-gallery'
import { PhotoPickerButton } from './photo-picker'
import { EmptyState, PageHeader, SortSelect, StatCard } from './primitives'
import { photoCategoryLabels } from '@/lib/labels'
import { formatBytes, formatJalaliDateTime, toFa } from '@/lib/persian'
import { db } from '@/lib/localdb'
import { useAppStore } from '@/store/app-store'
import type { Photo, PhotoCategory } from '@/lib/types'

type SortKey = 'newest' | 'oldest' | 'title'

const sortOptions: Array<{ value: SortKey; label: string }> = [
  { value: 'newest', label: 'جدیدترین' },
  { value: 'oldest', label: 'قدیمی‌ترین' },
  { value: 'title', label: 'عنوان' },
]

const categoryKeys = Object.keys(photoCategoryLabels) as PhotoCategory[]

export default function PhotosView() {
  const params = useAppStore((s) => s.params)

  // اعتبارسنجی دسته از پارامترها (مقدار نامعتبر → همه)
  const isValidCategory = (v: string | undefined): v is PhotoCategory =>
    !!v && (Object.keys(photoCategoryLabels) as string[]).includes(v)

  // فیلترهای نمایش گالری
  const [filterProjectId, setFilterProjectId] = React.useState<string>(params.projectId ?? 'all')
  const [filterCategory, setFilterCategory] = React.useState<PhotoCategory | 'all'>(
    isValidCategory(params.category) ? params.category : 'all'
  )
  const [sort, setSort] = React.useState<SortKey>('newest')

  // همگام‌سازی فیلترها با پارامترهای ناوبری (ورود عمیق از جست‌وجو/جزئیات)
  React.useEffect(() => {
    setFilterProjectId(params.projectId ?? 'all')
    setFilterCategory(isValidCategory(params.category) ? params.category : 'all')
     
  }, [params.projectId, params.category])

  // زمینه ثبت عکس جدید (پروژه اختیاری، دسته الزامی)
  const [pickerProjectId, setPickerProjectId] = React.useState<string>('none')
  const [pickerCategory, setPickerCategory] = React.useState<PhotoCategory>('project')

  const [preview, setPreview] = React.useState<Photo | null>(null)

  const projects = useLiveQuery(async () => {
    const list = await db.projects.filter((p) => !p.archived).toArray()
    return list.sort((a, b) => a.name.localeCompare(b.name, 'fa'))
  }, [])

  const totalPhotos = useLiveQuery(() => db.photos.count(), [])

  const filteredPhotos = useLiveQuery(async () => {
    let col = db.photos.orderBy('createdAt')
    if (filterProjectId !== 'all') col = col.filter((p) => p.projectId === filterProjectId)
    if (filterCategory !== 'all') col = col.filter((p) => p.category === filterCategory)
    return col.toArray()
  }, [filterProjectId, filterCategory])

  const totalSize = React.useMemo(
    () => (filteredPhotos ?? []).reduce((sum, p) => sum + p.size, 0),
    [filteredPhotos]
  )

  // ---------- لینک عمیق: باز شدن پیش‌نمایش برای photoId (فقط یک بار در هر نشانی) ----------
  const deepPhotoConsumedRef = React.useRef(false)
  React.useEffect(() => {
    deepPhotoConsumedRef.current = false
  }, [params.photoId])
  React.useEffect(() => {
    if (deepPhotoConsumedRef.current) return
    const id = params.photoId
    if (!id || !filteredPhotos) return
    deepPhotoConsumedRef.current = true
    const rec = filteredPhotos.find((p) => p.id === id)
    if (rec) setPreview(rec)
     
  }, [filteredPhotos, params.photoId])

  // مرتب‌سازی سفارشی — فقط برای «قدیمی‌ترین/عنوان» (جدیدترین را خود PhotoGallery رندر می‌کند)
  const sortedPhotos = React.useMemo(() => {
    if (!filteredPhotos) return undefined
    const arr = [...filteredPhotos]
    if (sort === 'oldest') arr.sort((a, b) => a.createdAt - b.createdAt)
    if (sort === 'title') arr.sort((a, b) => a.title.localeCompare(b.title, 'fa'))
    return arr
  }, [filteredPhotos, sort])

  const galleryFilter = {
    projectId: filterProjectId === 'all' ? undefined : filterProjectId,
    category: filterCategory === 'all' ? undefined : filterCategory,
  }

  const pickerLink = { projectId: pickerProjectId === 'none' ? undefined : pickerProjectId }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="عکس‌ها"
        subtitle="گالری سراسری عکس‌های ثبت‌شده روی همین دستگاه"
        actions={
          <PhotoPickerButton link={pickerLink} category={pickerCategory} baseTitle="عکس" label="افزودن عکس" />
        }
      />

      {/* زمینه ثبت عکس جدید */}
      <Card>
        <CardContent className="flex flex-col gap-3 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <ImagePlus className="size-4 text-primary" aria-hidden />
            ثبت عکس جدید
          </div>
          <p className="text-xs text-muted-foreground">
            پیش از ثبت، پروژه و دسته را انتخاب کنید. انتخاب دسته الزامی است؛ ثبت عکس بدون پروژه هم مجاز است.
          </p>
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex min-w-40 flex-1 flex-col gap-1.5">
              <span className="text-xs text-muted-foreground">پروژه (اختیاری)</span>
              <Select value={pickerProjectId} onValueChange={setPickerProjectId}>
                <SelectTrigger className="min-h-11 w-full" aria-label="پروژه عکس جدید">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent dir="rtl">
                  <SelectItem value="none">بدون پروژه</SelectItem>
                  {(projects ?? []).map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex min-w-40 flex-1 flex-col gap-1.5">
              <span className="text-xs text-muted-foreground">دسته (الزامی)</span>
              <Select value={pickerCategory} onValueChange={(v) => setPickerCategory(v as PhotoCategory)}>
                <SelectTrigger className="min-h-11 w-full" aria-label="دسته عکس جدید">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent dir="rtl">
                  {categoryKeys.map((c) => (
                    <SelectItem key={c} value={c}>
                      {photoCategoryLabels[c]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <PhotoPickerButton link={pickerLink} category={pickerCategory} baseTitle="عکس" label="افزودن عکس" />
          </div>
        </CardContent>
      </Card>

      {/* فیلتر و مرتب‌سازی */}
      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 p-4">
          <div className="flex min-w-40 flex-1 flex-col gap-1.5">
            <span className="text-xs text-muted-foreground">پروژه</span>
            <Select value={filterProjectId} onValueChange={setFilterProjectId}>
              <SelectTrigger className="min-h-11 w-full" aria-label="فیلتر پروژه">
                <SelectValue />
              </SelectTrigger>
              <SelectContent dir="rtl">
                <SelectItem value="all">همه پروژه‌ها</SelectItem>
                {(projects ?? []).map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex min-w-40 flex-1 flex-col gap-1.5">
            <span className="text-xs text-muted-foreground">دسته</span>
            <Select value={filterCategory} onValueChange={(v) => setFilterCategory(v as PhotoCategory | 'all')}>
              <SelectTrigger className="min-h-11 w-full" aria-label="فیلتر دسته">
                <SelectValue />
              </SelectTrigger>
              <SelectContent dir="rtl">
                <SelectItem value="all">همه دسته‌ها</SelectItem>
                {categoryKeys.map((c) => (
                  <SelectItem key={c} value={c}>
                    {photoCategoryLabels[c]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-xs text-muted-foreground">مرتب‌سازی</span>
            <SortSelect value={sort} onChange={(v) => setSort(v as SortKey)} options={sortOptions} />
          </div>
        </CardContent>
      </Card>

      {filteredPhotos === undefined ? (
        <div className="flex justify-center py-10" role="status" aria-label="در حال بارگذاری عکس‌ها">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : filteredPhotos.length === 0 ? (
        <EmptyState
          icon={<ImageIcon className="size-10" />}
          title={totalPhotos === 0 ? 'هنوز عکسی ثبت نشده است' : 'با فیلترهای فعلی عکسی یافت نشد'}
          hint={
            totalPhotos === 0
              ? 'با دکمه «افزودن عکس» اولین عکس را ثبت کنید. عکس‌ها فقط در حافظه همین دستگاه ذخیره می‌شوند.'
              : 'فیلتر پروژه یا دسته را تغییر دهید تا عکس‌های بیشتری ببینید.'
          }
        />
      ) : (
        <>
          {/* نوار آمار */}
          <div className="grid grid-cols-2 gap-3">
            <StatCard
              label="عکس‌های فیلترشده"
              value={toFa(filteredPhotos.length)}
              icon={<ImageIcon className="size-4" />}
              tone="accent"
            />
            <StatCard label="حجم مجموع این عکس‌ها" value={formatBytes(totalSize)} icon={<ImagePlus className="size-4" />} />
          </div>

          {sort === 'newest' ? (
            /* جدیدترین — گالری کامل با پیش‌نمایش/بزرگ‌نمایی/ویرایش/حذف */
            <PhotoGallery filter={galleryFilter} emptyHint="عکسی یافت نشد." />
          ) : (
            /* قدیمی‌ترین/عنوان — شبکه ساده بر اساس تصاویر بندانگشتی (dataURL) */
            <SimpleGrid photos={sortedPhotos ?? []} onPreview={setPreview} />
          )}
        </>
      )}

      {/* پیش‌نمایش ساده برای مرتب‌سازی سفارشی */}
      <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle>پیش‌نمایش</DialogTitle>
            <DialogDescription>{preview ? preview.title : ''}</DialogDescription>
          </DialogHeader>
          {preview && (
            <div className="flex flex-col gap-3">
              <div className="overflow-hidden rounded-lg bg-muted/40">
                <img
                  src={preview.thumb}
                  alt={preview.title}
                  className="mx-auto max-h-[55vh] w-auto object-contain"
                />
              </div>
              <div className="space-y-1 text-xs text-muted-foreground">
                <p>
                  دسته: {photoCategoryLabels[preview.category]} • {formatBytes(preview.size)} •{' '}
                  {toFa(preview.width)}×{toFa(preview.height)}
                </p>
                <p>زمان ثبت: {formatJalaliDateTime(preview.createdAt)}</p>
                {preview.description && <p>{preview.description}</p>}
              </div>
              <p className="text-xs text-muted-foreground">
                برای ویرایش، حذف یا بزرگ‌نمایی کامل، مرتب‌سازی را روی «جدیدترین» بگذارید.
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

/** شبکه ساده عکس‌ها برای مرتب‌سازی «قدیمی‌ترین/عنوان» — کلیک = پیش‌نمایش سبک با thumb */
function SimpleGrid({ photos, onPreview }: { photos: Photo[]; onPreview: (p: Photo) => void }) {
  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
      {photos.map((p) => (
        <div key={p.id} className="overflow-hidden rounded-lg border bg-card">
          <button
            type="button"
            className="block w-full cursor-zoom-in"
            onClick={() => onPreview(p)}
            aria-label={`مشاهده ${p.title}`}
          >
            <img src={p.thumb} alt={p.title} className="aspect-square w-full object-cover" loading="lazy" />
          </button>
          <div className="p-1.5">
            <p className="truncate text-[11px] font-medium" title={p.title}>
              {p.title}
            </p>
            <p className="text-[10px] text-muted-foreground">{photoCategoryLabels[p.category]}</p>
          </div>
        </div>
      ))}
    </div>
  )
}
