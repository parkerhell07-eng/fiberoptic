'use client'

// فایبرکار — تولید گزارش PDF فارسی و راست‌چین برای پروژه‌ها (کاملاً آفلاین)
import * as React from 'react'
import { ChevronDown, ChevronUp, FileDown, FileText, Info, Loader2 } from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Progress } from '@/components/ui/progress'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { PhotoGallery } from './photo-gallery'
import { EmptyState, Field, PageHeader, SegmentedTabs } from './primitives'
import { messages } from '@/lib/labels'
import { toFa } from '@/lib/persian'
import { db } from '@/lib/localdb'
import {
  defaultSections,
  generateProjectReport,
  shareOrDownloadBlob,
  type ReportSections,
} from '@/lib/pdf'
import { useAppStore } from '@/store/app-store'

type ReportMode = 'summary' | 'full'

const modeOptions: Array<{ value: ReportMode; label: string }> = [
  { value: 'summary', label: 'خلاصه' },
  { value: 'full', label: 'کامل' },
]

const sectionItems: Array<{ key: keyof ReportSections; label: string }> = [
  { key: 'info', label: 'مشخصات پروژه' },
  { key: 'routes', label: 'مسیرها' },
  { key: 'boxes', label: 'باکس‌ها' },
  { key: 'operations', label: 'عملیات' },
  { key: 'fusions', label: 'فیوژن' },
  { key: 'powerTests', label: 'تست توان' },
  { key: 'dropCables', label: 'دراپ‌کابل' },
  { key: 'photos', label: 'تصاویر' },
]

interface ReportResult {
  blob: Blob
  url: string
  name: string
}

export default function ReportsView() {
  const params = useAppStore((s) => s.params)
  const navigate = useAppStore((s) => s.navigate)

  const [projectId, setProjectId] = React.useState<string>(params.projectId ?? '')
  const [mode, setMode] = React.useState<ReportMode>('summary')
  const [sections, setSections] = React.useState<ReportSections>({ ...defaultSections })
  const [photoIds, setPhotoIds] = React.useState<string[]>([])
  const [photosOpen, setPhotosOpen] = React.useState(false)
  const [busy, setBusy] = React.useState(false)
  const [progress, setProgress] = React.useState<{ done: number; total: number } | null>(null)
  const [result, setResult] = React.useState<ReportResult | null>(null)

  const projects = useLiveQuery(async () => {
    const list = await db.projects.filter((p) => !p.archived).toArray()
    return list.sort((a, b) => a.name.localeCompare(b.name, 'fa'))
  }, [])

  const project = useLiveQuery(
    () => (projectId ? db.projects.get(projectId) : undefined),
    [projectId]
  )

  const projectPhotos = useLiveQuery(
    async () => (projectId ? db.photos.where('projectId').equals(projectId).toArray() : []),
    [projectId]
  )

  // با تغییر پروژه، انتخاب عکس‌ها از نو
  React.useEffect(() => {
    setPhotoIds([])
  }, [projectId])

  // آزادسازی object URL پس از بستن پیش‌نمایش یا خروج از صفحه
  React.useEffect(() => {
    return () => {
      if (result) URL.revokeObjectURL(result.url)
    }
  }, [result])

  const allPhotoIds = React.useMemo(() => (projectPhotos ?? []).map((p) => p.id), [projectPhotos])

  function toggleSection(key: keyof ReportSections, checked: boolean | 'indeterminate') {
    setSections((s) => ({ ...s, [key]: checked === true }))
  }

  async function handleGenerate() {
    if (!projectId) {
      toast.error('لطفاً ابتدا پروژه را انتخاب کنید')
      return
    }
    setBusy(true)
    setProgress(null)
    try {
      const blob = await generateProjectReport({
        projectId,
        mode,
        sections,
        photoIds: photoIds.length > 0 ? photoIds : undefined,
        onProgress: (done, total) => setProgress({ done, total }),
      })
      const url = URL.createObjectURL(blob)
      setResult({ blob, url, name: `گزارش-${project?.name ?? 'پروژه'}.pdf` })
      toast.success('گزارش با موفقیت تولید شد')
    } catch (e) {
      const detail = (e as Error)?.message ?? messages.error
      toast.error(`تولید گزارش ناموفق بود: ${detail}`)
    } finally {
      setBusy(false)
      setProgress(null)
    }
  }

  async function handleShare() {
    if (!result) return
    try {
      const how = await shareOrDownloadBlob(result.blob, result.name)
      toast.success(how === 'shared' ? 'گزارش برای اشتراک‌گذاری ارسال شد' : 'گزارش دانلود شد')
    } catch {
      toast.error(messages.error)
    }
  }

  // حالت بارگذاری
  if (projects === undefined) {
    return (
      <div className="flex flex-col gap-4">
        <PageHeader title="گزارش PDF" subtitle="تولید گزارش رسمی پروژه‌ها" />
        <div className="flex justify-center py-12" role="status" aria-label="در حال بارگذاری">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  // بدون پروژه
  if (projects.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        <PageHeader title="گزارش PDF" subtitle="تولید گزارش رسمی پروژه‌ها" />
        <EmptyState
          icon={<FileText className="size-10" />}
          title="هنوز پروژه‌ای ثبت نشده است"
          hint="برای تولید گزارش، ابتدا یک پروژه بسازید و داده‌های آن را ثبت کنید."
          actionLabel="رفتن به پروژه‌ها"
          onAction={() => navigate('projects')}
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="گزارش PDF" subtitle="گزارش رسمی و آفلاین پروژه — فارسی و راست‌چین" />

      {/* تنظیمات گزارش */}
      <Card>
        <CardContent className="flex flex-col gap-5 p-4">
          <Field label="پروژه" required>
            <Select value={projectId || undefined} onValueChange={setProjectId}>
              <SelectTrigger className="min-h-11 w-full" aria-label="انتخاب پروژه">
                <SelectValue placeholder="انتخاب پروژه" />
              </SelectTrigger>
              <SelectContent dir="rtl">
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label="حالت گزارش" hint="حالت خلاصه جدول‌ها را فشرده‌تر می‌کند و ۸ عکس اول را درج می‌کند.">
            <SegmentedTabs
              options={modeOptions}
              value={mode}
              onChange={(v) => setMode(v as ReportMode)}
              className="w-full sm:w-64"
            />
          </Field>

          <Field label="بخش‌های گزارش">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {sectionItems.map(({ key, label }) => (
                <label
                  key={key}
                  className="flex min-h-11 cursor-pointer items-center gap-2.5 rounded-lg border p-3 text-sm transition-colors hover:bg-accent/50"
                >
                  <Checkbox
                    checked={sections[key]}
                    onCheckedChange={(v) => toggleSection(key, v)}
                    aria-label={`بخش ${label}`}
                  />
                  <span>{label}</span>
                </label>
              ))}
            </div>
          </Field>

          {/* انتخاب تصاویر گزارش */}
          <div className="rounded-xl border">
            <button
              type="button"
              onClick={() => setPhotosOpen((o) => !o)}
              aria-expanded={photosOpen}
              className="flex min-h-11 w-full items-center justify-between gap-2 p-3 text-sm font-semibold transition-colors hover:bg-accent/50"
            >
              <span>انتخاب تصاویر گزارش</span>
              <span className="flex items-center gap-2">
                {photosOpen ? (
                  <ChevronUp className="size-4 text-muted-foreground" aria-hidden />
                ) : (
                  <ChevronDown className="size-4 text-muted-foreground" aria-hidden />
                )}
              </span>
            </button>
            {photosOpen && (
              <div className="flex flex-col gap-3 border-t p-3">
                {projectId ? (
                  <>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs text-muted-foreground">
                        {toFa(photoIds.length)} عکس انتخاب شد
                        {sections.photos
                          ? ' — این عکس‌ها در گزارش درج می‌شوند.'
                          : ' — برای درج در گزارش، بخش «تصاویر» را فعال کنید.'}
                      </p>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="min-h-9"
                          onClick={() => setPhotoIds(allPhotoIds)}
                          disabled={allPhotoIds.length === 0}
                        >
                          انتخاب همه
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="min-h-9"
                          onClick={() => setPhotoIds([])}
                          disabled={photoIds.length === 0}
                        >
                          هیچ‌کدام
                        </Button>
                      </div>
                    </div>
                    <div className="max-h-96 overflow-y-auto rounded-lg">
                      <PhotoGallery
                        filter={{ projectId }}
                        selectable
                        selectedIds={photoIds}
                        onSelectionChange={setPhotoIds}
                        emptyHint="برای این پروژه عکسی ثبت نشده است."
                      />
                    </div>
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground">ابتدا پروژه را انتخاب کنید.</p>
                )}
              </div>
            )}
          </div>

          <Button onClick={handleGenerate} disabled={busy || !projectId} className="min-h-12 w-full text-base">
            {busy ? <Loader2 className="size-5 animate-spin" aria-hidden /> : <FileDown className="size-5" aria-hidden />}
            {busy ? 'در حال تولید گزارش…' : 'تولید گزارش PDF'}
          </Button>

          {busy && progress && (
            <div className="flex flex-col gap-1.5" role="status">
              <Progress
                value={progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0}
                aria-label="پیشرفت تولید گزارش"
              />
              <p className="text-center text-xs text-muted-foreground">
                صفحه {toFa(progress.done)} از {toFa(progress.total)}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* راهنما */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="flex items-start gap-2.5 p-4">
          <Info className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
          <p className="text-sm leading-7 text-muted-foreground">
            فونت فارسی، راست‌چین بودن، جدول‌ها و صفحه‌بندی به‌صورت خودکار اعمال می‌شود. گزارش از حالت خلاصه شامل ۸
            عکس اول است؛ در حالت کامل همه عکس‌های انتخابی درج می‌شوند.
          </p>
        </CardContent>
      </Card>

      {/* پیش‌نمایش گزارش */}
      <Dialog
        open={!!result}
        onOpenChange={(o) => {
          if (!o) setResult(null) // revoke در cleanup اثر result انجام می‌شود
        }}
      >
        <DialogContent className="max-w-3xl" dir="rtl">
          <DialogHeader>
            <DialogTitle>پیش‌نمایش گزارش</DialogTitle>
          </DialogHeader>
          {result && (
            <>
              <iframe
                src={result.url}
                className="h-[70vh] w-full rounded-lg border"
                title="پیش‌نمایش گزارش PDF"
              />
              <DialogFooter className="flex-row justify-start gap-2">
                <Button className="min-h-11 flex-1" onClick={handleShare}>
                  <FileDown className="size-4" aria-hidden />
                  اشتراک‌گذاری / دانلود
                </Button>
                <Button variant="outline" className="min-h-11 flex-1" onClick={() => setResult(null)}>
                  بستن
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
