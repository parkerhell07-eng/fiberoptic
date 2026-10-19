# Task 2-e — full-stack-developer — backup/restore + global search views

Date: session 2-e
Files owned (REPLACED stubs, default exports kept):
- src/components/fiberkar/backup-view.tsx
- src/components/fiberkar/search-view.tsx

No other files touched. No new packages/routes. No dev server or build run.

## Work Log
1. Read worklog.md (Task 1 contracts) + verified shared APIs: `@/lib/types`, `@/lib/labels`, `@/lib/persian`, `@/lib/localdb`, `@/lib/backup`, `@/store/app-store`, `@/components/fiberkar/primitives`, and `src/app/page.tsx` view wiring (components take no props; `params`/`navigate` from store).
2. backup-view.tsx — full implementation:
   - «وضعیت داده‌های فعلی»: live `useLiveQuery` counting all 9 tables + photo bytes sum (`db.photos.each`), grid of StatCards incl. «حجم عکس‌ها» (formatBytes), skeleton loading.
   - «آخرین پشتیبان»: `useLiveQuery(() => getLastBackupInfo(), [])` → InfoRows (formatJalaliDateTime / formatBytes / checksum first 10 chars, dir=ltr mono) + per-table count chips; null → «هنوز پشتیبانی تهیه نشده است».
   - «تهیه پشتیبان جدید»: busy button → `createBackupBlob()` → `saveBlobToDisk(blob, backupFileName())` → toast.success with size; AbortError (picker cancelled) → neutral toast; other errors → Persian toast.error; note about keeping the file safe.
   - «بررسی سلامت»: hidden `.json` input → `verifyBackupBlob` → emerald Alert (version/date/counts) or destructive Alert with Persian error.
   - «بازیابی»: separate input → verify first; ok → mode Dialog (ادغام / جایگزینی کامل with explicit warnings) → second-stage ConfirmDialog (merge: confirm; replace: destructive) → `restoreBackup(blob, mode)` with busy state → honest toast: «X رکورد بازیابی، Y رکورد رد شد» + per-table summary; 0-restored case reported via toast.warning. Data refreshes reactively after replace.
   - «منطقه خطر» (border-destructive): two-stage ConfirmDialog (warning → final «بله، همه‌چیز را پاک کن») → `resetAllData()` → toast.
3. search-view.tsx — full implementation:
   - Search input min-h-11 prefilled from `params.q`, 250ms debounce, clear (X) button; last q+filters persisted in sessionStorage so returning from a record restores the query.
   - Filters card: نوع Select (همه/پروژه/مسیر/باکس/عملیات/فیوژن/تست توان/دراپ‌کابل/پروفایل), وضعیت Select (deduped union of project+operation+box+install status labels), از/تا تاریخ via JalaliDatePicker, «شامل آرشیو» Switch (+ «حذف فیلترها» when active).
   - Query: single `useLiveQuery` (deps [q, typeFilter, statusFilter, fromDate, toDate, includeArchived]) loads all tables and filters client-side: normalized (toEnDigits+lowercase) substring match on the per-entity field lists from the spec; date range on `date`/`fusionDate` fields and `createdAt` (ms→local ISO) for projects/routes/boxes; status matched by Persian label; archived toggle only affects projects/routes/boxes.
   - Results grouped by entity with heading + toFa count, summary line «N نتیجه در M گروه»; ItemCard per record with jalali date + status badges + identifying fields; navigation per spec (project/route/box/operations/fusion(+boxId)/power-tests/drop-cables/profiles).
   - Empty q → hint EmptyState («نام پروژه، شماره باکس، مسیر، تاریخ، مسئول، نوع عملیات یا شناسه کابل را جست‌وجو کنید»); no results → EmptyState; loading → skeletons.
4. Fixed lint: react-hooks/refs rule forbade reading a `useRef` in useState initializers → replaced with one-time `React.useState(readStoredSearch)`.
5. Verified: `bun run lint` → 0 errors project-wide; `tsc --noEmit` → zero errors in my two files (remaining project errors are in other agents' in-progress files); dev.log shows clean compiles, GET / 200.

## Stage Summary
- Both views complete, Persian RTL, toFa numerals, jalali dates, emerald-only accents, min-h-11 touch targets, rounded-xl border p-4 cards, real IndexedDB data only, no `any`, no blue/indigo.
- Restore and wipe flows are explicitly double-confirmed with clear Persian warnings; verify runs before every restore; results reported honestly (incl. zero-restored and skipped counts).
- Contracts kept: default exports, `useAppStore` navigation, `@/lib/backup` + `@/lib/localdb` APIs, primitives (`PageHeader/EmptyState/StatCard/StatusBadge/ConfirmDialog/InfoRow/ItemCard/JalaliDatePicker`).
