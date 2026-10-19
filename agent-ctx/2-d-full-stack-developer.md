# Task 2-d — full-stack-developer — photos view + PDF reports view

## Scope
Owned files only (replaced stubs, default exports preserved):
- `src/components/fiberkar/photos-view.tsx`
- `src/components/fiberkar/reports-view.tsx`

No other files touched. No new packages, routes, or dev-server/build runs.

## Work Log
1. Read `worklog.md` (Task 1 contracts) + read shared foundation: `types.ts`, `labels.ts`, `persian.ts`, `localdb.ts` (photos schema), `pdf.ts` (generateProjectReport/shareOrDownloadBlob/defaultSections), `app-store.ts` (params/navigate), `primitives.tsx`, `photo-picker.tsx`, `photo-gallery.tsx`, `page.tsx` (views take no props; params come from store).
2. **photos-view.tsx**:
   - PageHeader «عکس‌ها» with PhotoPickerButton action («افزودن عکس») wired to picker-context state.
   - «ثبت عکس جدید» Card: project Select (`بدون پروژه` = `{ projectId: undefined }`, allowed per PhotoLink optional) + mandatory category Select (default `project`) + inline duplicate picker button for mobile ergonomics.
   - Filter toolbar Card (flex wrap): پروژه (`همه`/non-archived projects via `useLiveQuery`, fa-locale sort), دسته (`همه`/photoCategoryLabels), مرتب‌سازی via `SortSelect` (جدیدترین/قدیمی‌ترین/عنوان).
   - Filter prefill from `params.projectId` / `params.category` (NavParams).
   - Stats strip: 2 `StatCard`s — filtered count (`toFa`) + total size (`formatBytes`) computed from a `useLiveQuery` filtered query.
   - Default sort «جدیدترین»: renders shared `PhotoGallery` (full preview/zoom/edit/delete built-in).
   - Non-default sorts («قدیمی‌ترین»/«عنوان»): custom `SimpleGrid` using cheap `thumb` dataURLs + lightweight «پیش‌نمایش» Dialog (no blob zoom) with meta (category/size/dimensions/Jalali datetime) + hint to switch to «جدیدترین» for edit/delete/zoom. Thumbs are dataURLs → no object URLs to revoke.
   - Loading spinner, differentiated empty states (no photos at all vs. no results for filters), Persian digits everywhere, min-h-11 touch targets, no blue/indigo.
3. **reports-view.tsx**:
   - PageHeader «گزارش PDF»; loading state; EmptyState → `navigate('projects')` when no non-archived projects.
   - Config Card: پروژه* Select (non-archived projects, prefilled from `params.projectId`), حالت گزارش `SegmentedTabs` (خلاصه/کامل), sections checkbox grid (8 `ReportSections` keys with Persian labels, defaults from `defaultSections`).
   - «انتخاب تصاویر» collapsible: `PhotoGallery selectable filter={{projectId}}` inside `max-h-96 overflow-y-auto`, counter «N عکس انتخاب شد», انتخاب همه/هیچ‌کدام buttons (all ids via live query), selection auto-reset on project change, hint when «تصاویر» section unchecked.
   - Generate button: min-h-12, full width, busy state (spinner + «در حال تولید گزارش…»), disabled without project.
   - Progress: `onProgress` → `{done,total}` state → `Progress` bar + «صفحه X از Y» (toFa).
   - Success: `URL.createObjectURL(blob)` → Dialog max-w-3xl with `iframe h-[70vh]` («پیش‌نمایش گزارش PDF») + footer: «اشتراک‌گذاری / دانلود» → `shareOrDownloadBlob(blob, گزارش-{name}.pdf)` with result toast; «بستن» clears result — object URL revoked in the effect cleanup (also on regenerate & unmount).
   - Errors: `toast.error('تولید گزارش ناموفق بود: …')` (fa), share errors handled too.
   - Hint card with the exact required copy (summary = first 8 photos; full = all selected).
4. Quality gates: `bun run lint` → **zero errors/warnings**; `tsc --noEmit` → no errors in owned files (remaining errors are pre-existing in Task-1/example/skill files outside my scope); dev.log shows clean compiles, GET / 200.

## Stage Summary
- Both views fully implemented in Persian RTL with emerald/semantic tokens, real IndexedDB data only, toFa numerals, accessible controls (aria-labels, roles), mobile-first layout.
- Photos: filter/sort/stats/pick flows complete; selection & preview reuse shared components.
- Reports: full config → generate → progress → preview → share/download pipeline with correct object-URL lifecycle and photoIds wiring.
- Lint: clean. Ready for orchestrator integration review.
