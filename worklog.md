# FiberKar (فیبرکار) — Worklog

Project: Offline-first Persian RTL PWA for fiber-optic network technicians.
Stack: Next.js 16 (App Router, single `/` route SPA) + TypeScript + Tailwind 4 + shadcn/ui + Dexie (IndexedDB) + Zustand + sonner + next-themes. Font: Vazirmatn (local). Theme: emerald/green (fiber optic), no blue/indigo.

---
Task ID: 1
Agent: orchestrator (Z.ai Code)
Task: Foundation — deps, fonts, icons, local DB layer, shared primitives, app shell, router.

Work Log:
- Reviewed repo: Next.js 16 scaffold with full shadcn/ui set, dev server on :3000, Prisma present but UNUSED by design (offline-only app; data lives in IndexedDB).
- Installed: dexie, dexie-react-hooks, jalaali-js, jspdf, html2canvas-pro.
- Downloaded Vazirmatn woff2 (Regular/Medium/SemiBold/Bold) into src/fonts.
- Generated app icons (emerald fiber-optic logo) via scripts/gen-icons.mjs → public/icons/*.
- Created shared foundation files (see contracts below).

Stage Summary:
- ARCHITECTURE (all client-side, fully offline):
  - src/lib/types.ts        — all entity types + unions + helper types
  - src/lib/labels.ts       — ALL Persian labels maps + badge color variants
  - src/lib/persian.ts      — Jalali date utils (jalaali-js), fa digits, number/meter formatting, dBm<->mW conversion, todayISO()
  - src/lib/localdb.ts      — Dexie DB "fiberkar": tables projects/routes/boxes/operations/fusions/powerTests/dropCables/profiles/photos/settings; CRUD + cascade deletes + stats; export `db`
  - src/lib/images.ts       — image compress/thumbnail/blob<->dataURL/bytes format
  - src/lib/pdf.ts          — Persian RTL PDF (html2canvas-pro + jsPDF), generateProjectReport(opts) => Blob, shareOrDownloadBlob(blob,name)
  - src/lib/backup.ts       — createBackupBlob/verifyBackupBlob/restoreBackup(mode replace|merge)/resetAllData
  - src/store/app-store.ts  — Zustand: navigate(view, params), back(), current view+params; hash sync #/view?params
  - src/components/fiberkar/primitives.tsx — PageHeader, EmptyState, StatCard, StatusBadge, ConfirmDialog, JalaliDatePicker, Field/Labeled, NumberInput, SegmentedTabs, SortSelect, ItemCard
  - src/components/fiberkar/photo-picker.tsx — PhotoPickerButton (camera+gallery, saves to db)
  - src/components/fiberkar/photo-gallery.tsx — PhotoGallery (grid, preview+zoom, edit/delete, optional selection mode)
  - src/app/layout.tsx — html dir=rtl lang=fa, Vazirmatn localFont, ThemeProvider, sonner Toaster
  - src/app/page.tsx — SPA shell: header, bottom nav (5 tabs), "more" sheet, sticky footer, view switching
  - Placeholder view components created for agents to REPLACE (files listed in their task IDs).

- CONTRACTS for view agents:
  - Navigation: `const { navigate, back, params } = useAppStore()`; ViewKey union: dashboard|projects|project|route|box|operations|fusion|power-tests|drop-cables|photos|profiles|reports|backup|search
  - Data: `import { db, createXxx, updateXxx, deleteXxxCascade, archiveXxx, getDashboardStats } from '@/lib/localdb'` + `useLiveQuery(() => db.x.filter(...).toArray(), [deps])`
  - Toast: `import { toast } from 'sonner'` with Persian messages.
  - Dates stored as 'YYYY-MM-DD' (Gregorian ISO) in `date` fields; createdAt/updatedAt epoch ms. Display via persian.ts formatters.
  - Labels: import maps from '@/lib/labels' (never hardcode status strings).
  - Photo linkage: PhotoPickerButton link={{projectId?, routeId?, boxId?, operationId?, fusionId?, powerTestId?, dropCableId?}} category=...

Task ID: 1 (COMPLETE)
Status: lint clean, dev server 200, page renders RTL Persian with Vazirmatn.
Notes for view agents:
- mounted-guard in page.tsx prevents SSR access to IndexedDB (views only render client-side).
- db is a lazy Proxy; safe everywhere on client.
- After creating records, switch dialogs to edit-mode so PhotoPickerButton can attach photos with the new id.

---
Task ID: 2-d
Agent: full-stack-developer
Task: photos view + PDF reports view

Work Log:
- Read Task 1 contracts (worklog + types/labels/persian/localdb/pdf/app-store/primitives/photo-picker/photo-gallery/page.tsx).
- Replaced stub src/components/fiberkar/photos-view.tsx: PageHeader «عکس‌ها» + PhotoPickerButton action; «ثبت عکس جدید» toolbar (project optional = بدون پروژه → {projectId: undefined}, category mandatory default 'project'); filter toolbar (پروژه/دسته/مرتب‌سازی SortSelect: جدیدترین|قدیمی‌ترین|عنوان, prefilled from NavParams projectId/category); stats strip (filtered count toFa + sum size formatBytes) via useLiveQuery; default sort renders shared PhotoGallery (preview/zoom/edit/delete built-in); «قدیمی‌ترین/عنوان» render custom SimpleGrid from thumb dataURLs with lightweight «پیش‌نمایش» Dialog (no blob zoom) + hint; loading spinner + differentiated empty states (no photos vs. filter mismatch).
- Replaced stub src/components/fiberkar/reports-view.tsx: config Card (پروژه* Select non-archived, prefill params.projectId; حالت SegmentedTabs خلاصه/کامل; 8 sections checkboxes from defaultSections with Persian labels; collapsible «انتخاب تصاویر» with PhotoGallery selectable filter {projectId} in max-h-96 scroll area, counter «N عکس انتخاب شد», انتخاب همه/هیچ‌کدام, selection reset on project change); generate button min-h-12 full-width with busy state; progress via onProgress → Progress bar + «صفحه X از Y» (toFa); success → objectURL + Dialog max-w-3xl iframe h-[70vh] + «اشتراک‌گذاری / دانلود» → shareOrDownloadBlob(گزارش-{name}.pdf) with result toast + «بستن» (object URL revoked via effect cleanup on close/regenerate/unmount); errors → toast.error «تولید گزارش ناموفق بود: …»; hint card with required copy; no projects → EmptyState → navigate('projects').
- Gates: bun run lint → zero errors; tsc --noEmit → no errors in owned files (remaining are pre-existing in Task-1/examples/skills files, out of scope); dev.log compiles clean (GET / 200).

Stage Summary:
- photos-view + reports-view complete: Persian RTL, emerald/semantic tokens only, real IndexedDB data, toFa numerals, min-h-11 touch targets, aria labels, no 'any', progress/busy/loading/empty states, photo selection wired to generateProjectReport photoIds, object URLs revoked. Work record: /agent-ctx/2-d-full-stack-developer.md.
---
Task ID: 2-c
Agent: full-stack-developer
Task: drop-cables + profiles views

Work Log:
- Read worklog + foundation contracts (types/labels/persian/localdb/app-store/primitives/photo-picker/photo-gallery).
- Replaced stub src/components/fiberkar/drop-cables-view.tsx:
  - Filters bar (card): پروژه/مسیر(cascade)/مجری Selects + SegmentedTabs وضعیت نصب و تحویل + بازه تاریخ (دو JalaliDatePicker) + chips قابل حذف؛ پیش‌فرض از params.projectId/routeId/boxId (ورود از پروژه/مسیر/باکس)، بدون سوییچ «نمایش همه».
  - Stats strip (3 StatCard، داده واقعی): تعداد فیلترشده، مجموع متراژ اولیه، مجموع متراژ مصرفی (فقط مقادیر valid محاسبه‌شده از computeConsumed برای همه رکوردهای فیلترشده؛ بدون دوباره‌شماری مصرفی از رکورد).
  - List: ItemCard (مقصد، بج وضعیت نصب+تحویل، متا: نوع کابل • مصرفی با تگ «محاسباتی»/«واردشده توسط کاربر» یا — • مجری • تاریخ شمسی • روش • باکس مبدأ)؛ منوی سه‌نقطه ویرایش/حذف با ConfirmDialog → deleteDropCableCascade + toast.
  - Form Dialog (dir=rtl, max-w-lg, body اسکرول‌شونده): پروژه* با پیش‌فرض params، مسیر? (کاسکید + پاک‌شدن با تغییر پروژه)، باکس مبدأ؟، مقصد*، شناسه سرویس، آدرس، تاریخ* (JalaliDatePicker پیش‌فرض امروز)، مجری? (اسنپ‌شات از profileSnapshot)، نوع کابل*، برند/مدل، تعداد کور، متراژ اولیه/برگشتی (NumberField unit متر)، مصرفی کاربر? با hint «بدون تغییر ذخیره می‌شود»، پیش‌نمایش زنده bg-primary/5 (برچسب منبع یا پیام computeConsumed)، روش اجرا (custom → عنوان سفارشی*)، وضعیت نصب/تحویل، توضیحات.
  - Validation: مقصد/نوع کابل/پروژه/تاریخ الزامی؛ validateMeterage برای سه متراژ (+تعداد کور)؛ returned>initial → خطای «متراژ برگشتی نمی‌تواند بیشتر از متراژ اولیه باشد»؛ toast اولین خطا.
  - Save: consumedUser عیناً (یا undefined)؛ consumedAuto فقط وقتی user ارائه نشده و computeConsumed(initial,returned,undefined).valid — هرگز بازنویسی مقدار کاربر. اسنپ‌شات مجری؛ اگر پروفایل قبلی حذف شده باشد نام تاریخی رکورد هنگام ویرایش حفظ می‌شود.
  - After create → فرم به حالت ویرایش همان رکورد می‌رود (toast saved) تا PhotoPickerButton link {projectId, routeId, boxId: sourceBoxId در صورت انتخاب, dropCableId} + PhotoGallery filter {dropCableId} کار کند.
  - Loading (Skeleton)، حالت خالی دوگانه (بدون داده / نتیجه فیلتر خالی با اکشن پاک‌کردن فیلترها)، aria-label ها، RTL کامل و ارقام/تاریخ فارسی.
- Replaced stub src/components/fiberkar/profiles-view.tsx:
  - بنر اطلاع (text-xs) درباره محلی‌بودن پروفایل‌ها و اسنپ‌شات لحظه ثبت.
  - List: ItemCard نام+نام خانوادگی، بج همه نقش‌ها (custom → customRoleLabel)، متا شرکت • شهر • تلفن (toFa)، منو ویرایش/حذف (ConfirmDialog + deleteProfileSafe + توضیح حفظ سوابق).
  - Form Dialog (max-w-lg، اسکرول): نام*، نام خانوادگی*، تلفن?، شهر?، شرکت?، توضیحات، گرید Checkbox ۹ نقش (چند انتخاب، min-h-11)، custom → عنوان سفارشی*، فیلدهای نقش‌محور فقط در صورت انتخاب نقش (contractorArea / fusionDevice / testDevice / dropCableType+dropMethod)، ذخیره roles + roleData + customRoleLabel + toast.
  - After create → حالت ویرایش همان رکورد؛ مرتب‌سازی لیست با localeCompare فارسی.
- Type fixes in owned files: dir="rtl" را از DropdownMenuContent به DropdownMenu root منتقل کردم (تایپ radix v2)؛ فقط فایل‌های خودم تغییر کرد.
- bun run lint: 0 errors/0 warnings؛ tsc --noEmit برای فایل‌های خودم: clean (خطاهای باقی‌مانده در فایل‌های سایر ایجنت‌ها/foundation خارج از محدوده من است).
- dev.log: GET / 200 بدون خطای کامپایل.

Stage Summary:
- هر دو نما کامل، فارسی/RTL، موبایل‌اول (min-h-11، کارت‌های rounded-xl border p-4، gap-4)، بدون رنگ آبی/اینdigo، بدون داده ساختگی.
- قواعد سلامت داده رعایت شد: منفی ممنوع، consumedUser تغییرناپذیر با برچسب «واردشده توسط کاربر»، consumedAuto فقط محاسباتی با برچسب «محاسباتی»، نمایش «—» برای داده ناکافی.
- Files: src/components/fiberkar/drop-cables-view.tsx، src/components/fiberkar/profiles-view.tsx (default exports حفظ شد) + agent-ctx/2-c-full-stack-developer.md.

---
Task ID: 2-e
Agent: full-stack-developer
Task: backup/restore + global search views

Work Log:
- Read Task 1 contracts (worklog + types/labels/persian/localdb/backup/app-store/primitives + page.tsx wiring); verified @/lib/backup API signatures (createBackupBlob/verifyBackupBlob/restoreBackup/saveBlobToDisk/backupFileName + getLastBackupInfo from localdb).
- Replaced stub src/components/fiberkar/backup-view.tsx (default export kept):
  - «وضعیت داده‌های فعلی»: live useLiveQuery counts of all 9 tables + مجموع حجم عکس‌ها (db.photos.each sum size, formatBytes) → grid of StatCards + skeleton loading + note «داده‌ها فقط روی همین دستگاه».
  - «آخرین پشتیبان»: useLiveQuery(getLastBackupInfo) → InfoRow زمان (formatJalaliDateTime) / حجم (formatBytes) / checksum اولین ۱۰ کاراکتر (dir=ltr mono) + chips تعداد رکوردها per table (toFa)؛ null → «هنوز پشتیبانی تهیه نشده است».
  - «تهیه پشتیبان جدید»: دکمه بزرگ min-h-12 با busy → createBackupBlob() → saveBlobToDisk(blob, backupFileName()) → toast.success «پشتیبان ذخیره شد (حجم)» + توضیح محل ذخیره؛ AbortError (لغو picker) → toast.info فارسی؛ سایر خطاها → toast.error؛ متن «فایل شامل تمام داده‌ها و عکس‌هاست؛ آن را در محل امن نگه دارید.»
  - «بررسی سلامت»: hidden input accept=.json → verifyBackupBlob → ok → Alert سبز emerald (نسخه/تاریخ شمسی/شمارش جدول‌ها)؛ خطا → Alert destructive با error فارسی.
  - «بازیابی»: input جداگانه → ابتدا verify؛ سالم → Dialog انتخاب حالت با هشدار صریح («ادغام: فقط رکوردهای جدید اضافه می‌شوند» / «جایگزینی کامل: همه داده‌های فعلی پاک و با پشتیبان جایگزین می‌شود») → ConfirmDialog دومرحله‌ای (replace destructive) → restoreBackup(blob, mode) با busy → toast صادقانه «X رکورد بازیابی، Y رکورد رد شد» + خلاصه per-table؛ restored=0 → toast.warning؛ خطا → toast.error با پیام فارسی. پس از replace داده‌ها reactive به‌روز می‌شوند.
  - «منطقه خطر» (border-destructive): دکمه destructive → ConfirmDialog دومرحله‌ای (هشدار «تمام داده‌ها و عکس‌ها حذف می‌شود» → تأیید نهایی «بله، همه‌چیز را پاک کن») → resetAllData() → toast.
- Replaced stub src/components/fiberkar/search-view.tsx (default export kept):
  - ورودی min-h-11 با پیش‌فرض params.q + debounce 250ms + دکمه پاک‌کردن (X)؛ آخرین q و فیلترها در sessionStorage نشست حفظ می‌شود تا با back() بازیابی شود.
  - فیلترها (Card): نوع Select (همه/پروژه‌ها/مسیرها/باکس‌ها/عملیات/فیوژن/تست توان/دراپ‌کابل/پروفایل‌ها)، وضعیت Select (اجتماع بدون تکرار operationStatus+projectStatus+boxStatus+installStatus)، از/تا تاریخ (JalaliDatePicker)، Switch «شامل آرشیو» (فقط پروژه/مسیر/باکس) + دکمه «حذف فیلترها».
  - Logic: یک useLiveQuery با deps [debouncedQ, typeFilter, statusFilter, fromDate, toDate, includeArchived] → واکشی ۸ جدول و فیلتر سمت کلاینت: تطبیق includes روی فیلدهای تعیین‌شده spec با نرمال‌سازی toEnDigits/lowercase؛ بازه تاریخ روی date/fusionDate عملیات/فیوژن/تست/دراپ و createdAt (ms→ISO محلی) برای پروژه/مسیر/باکس؛ وضعیت با تطبیق برچسب فارسی.
  - Results: گروه‌بندی ۸ بخشی با هدر + شمارش toFa + خط خلاصه «N نتیجه در M گروه»؛ هر نتیجه ItemCard (اطلاعات شناسنامه‌ای + تاریخ شمسی + بج وضعیت؛ تست توان با dir=ltr مقدار/واحد) و ناوبری طبق spec: project/route/box/operations/fusion(+boxId?)/power-tests/drop-cables/profiles.
  - حالت‌ها: q خالی → EmptyState راهنما («نام پروژه، شماره باکس، مسیر، تاریخ، مسئول، نوع عملیات یا شناسه کابل را جست‌وجو کنید»)؛ بدون نتیجه → EmptyState؛ بارگذاری → Skeleton.
- Lint fix: قانون react-hooks/refs خواندن ref در initializer را ممنوع می‌کرد → جایگزینی با useState(readStoredSearch) یک‌باره.
- Gates: bun run lint → 0 errors/0 warnings (کل پروژه)؛ tsc --noEmit → فایل‌های من بدون خطا (خطاهای باقی‌مانده متعلق به فایل‌های در دست ساخت ایجنت‌های دیگر است)؛ dev.log کامپایل تمیز و GET / 200.

Stage Summary:
- backup-view + search-view کامل: فارسی RTL، ارقام فارسی (toFa)، تاریخ شمسی، فقط رنگ emerald/semantic (بدون آبی/indigo)، اهداف لمسی min-h-11، کارت‌های rounded-xl border p-4، داده واقعی IndexedDB (بدون mock)، بدون 'any'.
- ایمنی داده: هر بازیابی ابتدا verify می‌شود، حالت replace/ادغام با دو مرحله تأیید و هشدار شفاف فارسی، نتیجه واقعی (restored/skipped per table) صادقانه گزارش می‌شود؛ پاک‌سازی کامل دومرحله‌ای است.
- Files: src/components/fiberkar/backup-view.tsx، src/components/fiberkar/search-view.tsx + work record at /agent-ctx/2-e-full-stack-developer.md.

---
Task ID: 2-b
Agent: full-stack-developer
Task: operations + fusion + power-tests views
Work Log:
- Read Task 1 contracts (types/labels/persian/localdb/store/primitives/photo-picker/photo-gallery); confirmed Dexie indexes for createdAt-desc listing.
- Implemented the full common pattern in each owned file (helpers duplicated locally; no shared file touched): filter chips + local Selects (project→route→box cascade, «همه» sentinel), useLiveQuery list sorted createdAt desc with Loader/EmptyState, ItemCards with jalali dates + toFa counts, trailing DropdownMenu (dir on root) → ویرایش/حذف via ConfirmDialog + deleteXxxCascade + toasts, form Dialog (dir rtl, max-w-lg, max-h-[85vh] overflow-y-auto) with Persian validation, create→switch-to-edit-mode (photos attach with real id), edit→update+close.
- operations-view: title*/type(+custom label*)/date*/status/project*/route?/box?/مسئول (profileSnapshot→assigneeProfileId+Name+Role; keeps prior snapshot if profile deleted)/description/techSpecs; card shows type+status badges, date, assignee(+role), project/route/box names; photo category derived from operation type.
- fusion-view: project*/route?/box?/connectionId/fiberNumbers*(ltr)/tubeNumber/cableSpec/deviceModel/result (stored VERBATIM, never altered; note «مقدار ساختگی درج نمی‌شود»)/fusionDate*/description; card shows اتصال/تارها/نتیجه (verbatim ltr)/باکس/تاریخ; edit-mode = 3 quick photo buttons (قبل/حین/بعد از فیوژن, category fusion) + gallery {fusionId}.
- power-tests-view: project*/route?/box?/location*/date*/value*(NumberField)/unit*(dBm default)/wavelengthNm(nm)/deviceModel/مسئول (name snapshot — PowerTest type has no assigneeRole)/description; validation value finite + mW>0 rule; live «معادل محاسباتی» chip via convertedPower (display-only, never stored); card = big value+unit, location, device, assignee, wavelength, باکس, تاریخ; photo «عکس صفحه دستگاه» (power_test) + gallery {powerTestId}.
- Type QA: aliased lucide Box→BoxIcon (entity-type collision ×3), moved dir="rtl" to DropdownMenu root (content props don't accept it), dropped assigneeRole from power-test flow to match PowerTest/PowerTestInput.
- Verification: bun run lint → exit 0 (zero errors); bunx tsc --noEmit → zero errors in owned files; dev.log compiled, GET / 200.
Stage Summary:
-operations-view.tsx / fusion-view.tsx / power-tests-view.tsx fully implemented (default exports kept), 100% Persian RTL, emerald, mobile-first min-h-11, rounded-xl border p-4 cards, gap-4.
- Data integrity: recorded values (fusion result string, power test number) stored exactly as entered; conversions display-only and always labeled «محاسباتی»; no mock/seed data anywhere.
- Agent record: /agent-ctx/2-b-full-stack-developer.md (includes notes: DropdownMenuContent has no dir prop — pass dir to DropdownMenu root; PowerTest lacks assigneeRole).

---
Task ID: 2-a
Agent: full-stack-developer
Task: dashboard + projects + project/route/box details

Work Log:
- Read worklog + all foundation contracts (types, labels, persian, localdb, primitives, photo-picker/gallery, app-store, page.tsx shell) before writing code.
- Implemented `dashboard.tsx`: real stats via useLiveQuery(getDashboardStats) with skeleton loading; 10-card stats grid (grid-cols-2 sm:grid-cols-4) incl. متراژ مصرفی via formatMeters; 6 shortcut cards (پروژه جدید/ثبت عملیات/تست توان/دراپ‌کابل/گزارش PDF/پشتیبان‌گیری) navigating via store; last 5 projects + last 5 operations as ItemCards (click → project detail / operations with params); zero-data → EmptyState hinting to create first project (recents hidden until data exists).
- Implemented `projects-view.tsx`: search input (name/code/client/area), SegmentedTabs status filter (همه + 4 statuses), Switch «نمایش آرشیو» (shows only archived when on); per-project counts (routes/boxes/photos) computed in ONE useLiveQuery with Promise.all over visible projects (indexed where().count()); ItemCards with StatusBadge + counts meta + DropdownMenu (ویرایش/آرشیو/حذف destructive); full create/edit dialog (dir=rtl, max-w-lg, name*+client* validation with Persian field errors, JalaliDatePicker optional startDate, status Select default in_progress, پیمانکار/مجری Selects from db.profiles with 'none' sentinel, description Textarea); createProject/updateProject → toast.saved/updated, stay on page; delete via ConfirmDialog + deleteProjectCascade.
- Implemented `project-detail.tsx`: guards (no id → EmptyState; undefined → Loader2 spinner; null → «پروژه یافت نشد»); PageHeader with گزارش PDF (→reports with projectId) + edit/archive/delete icon actions; ProjectEditDialog (local, edit-only); StatCards row from getProjectStats; SegmentedTabs خلاصه/مسیرها/باکس‌ها/عملیات/عکس‌ها: summary InfoRows incl. profile lookups (پیمانکار/مجری) from db.profiles; routes tab (local RouteFormDialog create/edit, box counts derived from boxes liveQuery, RowMenu archive/deleteRouteCascade); boxes tab (local BoxFormDialog with required route Select from project routes incl. «(آرشیو)» suffix, status Select default not_installed, deleteBoxCascade); operations tab (read-only list + «ثبت عملیات» → operations view with params, rows navigate with operationId); photos tab (PhotoPickerButton link {projectId} category 'project' + PhotoGallery).
- Implemented `route-detail.tsx`: guards; header edit (inline dialog)/archive/delete (→ navigate back to project); info card (project name, code, description, created); boxes of route list + «باکس جدید» dialog prefilled projectId/routeId (route Select defaults to current route); photos via PhotoPickerButton link {projectId, routeId} + PhotoGallery filter {routeId}.
- Implemented `box-detail.tsx`: guards; PageHeader «باکس {number}» + edit/archive/delete (delete → project view); InfoRows (status badge, محل, ظرفیت, کابل, مسیر lookup, پروژه lookup, created); SegmentedTabs فیوژن‌ها/تست توان/عملیات/دراپ‌کابل/عکس‌ها — each section: live count + compact real-data list (fusions: تارها/اتصال/تیوب/نتیجه/تاریخ; power tests: value+unit+nm/محل/دستگاه/مسئول; operations: title+status badge+date+مسئول; drop cables: مقصد/شناسه سرویس/وضعیت نصب) + full-width nav button → fusion/power-tests/operations/drop-cables views with {projectId, routeId, boxId}; photos tab with category 'box_install'.
- Fixed 2 TS strictness issues found via tsc: hoisted `async function` handlers capturing narrowed box/route converted to arrow consts (narrowing-safe); moved `dir="rtl"` from DropdownMenuContent → DropdownMenu root (Radix 6 omits dir on Content props; root drives RTL for whole menu).

Stage Summary:
- All 5 owned view files implemented, self-contained (no new shared files created; forms duplicated locally per task spec).
- Strict typing throughout: no `any`, all entities typed from @/lib/types; inputs typed via ProjectInput/RouteInput/BoxInput.
- UX contract respected: min-h-11 touch targets, rounded-xl border p-4 cards, gap-3/4 spacing, skeletons while loading, EmptyState when empty, ConfirmDialog for ALL destructive actions, archive-before-delete, toast.success on create/update/delete, dialogs dir="rtl" with max-h-[60vh] scrollable forms.
- Verified: `bun run lint` → 0 errors (project-wide clean); `bunx tsc --noEmit` → 0 errors in the 5 owned files (remaining tsc notes are in foundation/other-agent files: photo-picker DropdownMenuContent dir, photo-gallery Photo type, lib/pdf, lib/images, persian jalaali-js default import — NOT touched per ownership rules); dev server GET / 200.
- Note for later agents: Radix DropdownMenuContent does NOT accept `dir` in this version — put `dir="rtl"` on `<DropdownMenu>` root instead. Also keep `useLiveQuery` deps primitive/stable to avoid re-subscribe storms.

---
Task ID: 3
Agent: orchestrator (Z.ai Code)
Task: Integration, type-safety, fixes across all agent outputs.

Work Log:
- Fixed TS errors: persian.ts (jalaali-js v2 named exports), images.ts (ImageBitmap close narrowing), pdf.ts (pages Block[][] + 24px pagination safety margin), photo-gallery.tsx (PhotoEntity import), photo-picker.tsx (dir on DropdownMenu root).
- Excluded scaffold dirs (examples/skills/tests) from tsconfig for clean project type-check.
- bun run lint: 0 errors. bunx tsc --noEmit: 0 errors. dev.log: no runtime errors.

Stage Summary:
- Project fully type-safe and lint-clean; all 14 views integrated into SPA shell.

---
Task ID: 4
Agent: orchestrator (Z.ai Code)
Task: End-to-end verification with Agent Browser (real browser, real IndexedDB).

Work Log (ALL TESTS EXECUTED — none skipped):
1. Create project (name/code/client/area/desc) → toast «با موفقیت ذخیره شد» ✓
2. Create route RT-01 + box B-12 inside project hierarchy ✓
3. Box detail → navigate to fusion with prefill (project/route/box) ✓
4. Create fusion SP-1204 (fibers 1,2,5-8, tube 2, result "0.02 dB" verbatim) → dialog switched to edit-mode with 3 photo slots ✓
5. Upload real JPEG to «عکس حین کار» via file input → saved with Persian timestamped title ✓
6. Power test: -18.42 dBm @1550nm EXFO → conversion chip «معادل محاسباتی: ۰.۰۱۴۴ mW» (display-only, correct math) + device-screen photo upload ✓
7. Drop cable: initial 320 / returned 18 → live preview «۳۰۲ متر (محاسباتی)»; validation returned=500>320 BLOCKED with Persian error; negative blocked ✓
8. Delete drop cable (ConfirmDialog cascade) → gone; then restore from backup (replace mode) → record + 302m total RETURNED ✓
9. Backup: create (94KB, SHA-256 fingerprint shown) → verify file «فایل سالم است» with counts ✓ → restore replace: 2-stage confirm → success ✓ (photos rehydrated from base64→Blob, links intact)
10. Search: «کریمی»→drop cable hit; «B-12»→box hit ✓
11. Profile: create offline (offline emulation ON) — roles checkboxes, conditional fields (محدوده فعالیت) appeared, saved with Persian phone formatting ✓
12. Operation with assignee snapshot «علی محمدی (پیمانکار)» preserved ✓
13. Persistence: full page reload → all data + photos intact ✓
14. PDF report: generated → valid %PDF 2 pages, 417KB → Persian connected letters, RTL tables, photos with captions, header/footer, page numbers «صفحه ۱ از ۲» verified visually ✓
15. Offline behavior: all data ops work offline (IndexedDB). NOTE: offline page-reload in dev mode shows dino page because SW registers only in production builds (deliberate; HMR-safe).
16. Edit flow: project edit saved (فاز ۲) ✓
17. Danger zone: full data wipe via 2-stage confirm → all counts ۰ ✓ (test data cleaned; no fake data in final state)
18. Layout: mobile 390px + desktop 1440px screenshots OK; footer pushed naturally (0px gap below footer); dark mode verified ✓

Stage Summary:
- 17/17 mandatory test scenarios executed and passed in a real browser.
- Console: only harmless Radix aria-describedby warning; zero page errors.
- App left in clean first-run state.

---
Task ID: 5
Agent: orchestrator (Z.ai Code)
Task: Docs, APK pipeline, final packaging.

Work Log:
- next.config.ts: CAP_EXPORT=1 → static export (out/) for Capacitor; api route made force-static for export compatibility.
- Created .github/workflows/build-apk.yml (lint → static build → cap add/sync → gradle assembleDebug/Release → artifacts + Release on tags).
- Created docs/BUILD-APK.md (local Capacitor build, signing, کافه‌بازار/مایکت checklist).
- Created README.md (features, privacy, architecture, honest limitations, test summary).
- Final state: lint 0 errors, tsc 0 errors, dev.log clean, app in clean first-run state (test data wiped via danger-zone).

Stage Summary:
- Deliverable: complete offline-first Persian RTL PWA + ready-made APK pipeline. APK itself NOT built here (no Android SDK in sandbox) — transparent limitation.

---
Task ID: 6
Agent: orchestrator (Z.ai Code)
Task: Android packaging (user request: "میخوام همین برنامه رو به برنامه ی اندرویدی تبدیل کنی و بسازی و بعدش که تموم شد ببریم روی گیتهاب") + GitHub readiness.

Work Log:
- Installed @capacitor/core@8, @capacitor/cli, @capacitor/android@8, @capacitor/filesystem, @capacitor/share.
- Created capacitor.config.ts (appId com.fiberkar.app, appName فیبرکار, webDir .next-cap, androidScheme https).
- next.config.ts: added NEXT_DIST_DIR env so Capacitor static export (.next-cap/) never clobbers dev .next; package.json: added build:cap script (CAP_EXPORT=1 NEXT_DIST_DIR=.next-cap next build) — fixes CI bug where old workflow ran standalone-copy steps in export mode.
- src/lib/native-bridge.ts (NEW): native Share Sheet + save-to-Documents via Capacitor plugins, wired into pdf.ts shareOrDownloadBlob() and backup.ts saveBlobToDisk(); web behavior unchanged (isNativeApp() false).
- Generated launcher icons + splash via @capacitor/assets from assets/ (icon 1024 + splash 2732 from public/icons).
- Built REAL Android SDK env: downloaded cmdline-tools, accepted licenses, installed platform-tools + platforms;android-36 + build-tools;36.0.0, downloaded Temurin JDK 21 (system java was JRE-only, no javac).
- bunx cap add android; committed android/ project; gradle.properties tuned for low-RAM builds (-Xmx1400m, no parallel).
- BUILD SUCCESSFUL: app-debug.apk (6.86MB) + assembleRelease (5.14MB unsigned) in 2m3s.
- Generated release keystore OUTSIDE repo (/home/z/fiberkar-release.keystore); zipalign -p 4 + apksigner sign → download/fiberkar-v1.0-release.apk (5.19MB, verified: CN=FiberKar cert OK).
- APK verified with aapt dump badging: com.fiberkar.app v1.0, minSdk 24, targetSdk 36, label فیبرکار, ONLY INTERNET permission; web assets embedded (index.html/manifest/icons/_next).
- Rewrote .github/workflows/build-apk.yml: bun build:cap → cap sync (android/ committed) → assembleDebug/Release → optional signing via Secrets (FIBERKAR_KEYSTORE_B64/PASSWORD/ALIAS/KEY_PASSWORD) → Release on v* tags.
- .gitignore: /android build outputs, /.next-cap/, *.apk, *.keystore, *.idsig; eslint ignores android/ + .next-cap/ + download/.
- Docs: docs/BUILD-APK.md rewritten (tested local build + CI signing secrets), README Android section updated with real APK facts.
- Verification: bun run lint → 0 errors; tsc --noEmit → 0 errors; agent-browser E2E smoke: dashboard render, create project, generate PDF report (dialog + share button OK), create backup (Jalali timestamp + SHA-256 + counts shown), delete project → clean empty state; ZERO console errors.
- Git: all changes committed locally on main. NOT pushed (awaiting user token — spec §15).

Stage Summary:
- Deliverable: REAL signed Android APK v1.0 (com.fiberkar.app) + full Capacitor project + CI pipeline + native share/save bridge.
- Honest limits: no physical device/emulator in sandbox → install-on-device not tested here; packaging verified via aapt/apksigner + the embedded web app is the same E2E-tested code.
- Next: push to GitHub once user provides token (fine-grained, Contents read+write); tag v1.0 triggers APK Release; optional signing secrets for signed CI APKs.
