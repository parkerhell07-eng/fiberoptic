# Task 2-b — full-stack-developer — operations / fusion / power-tests views

Date: 2026-02-27
Status: DONE — `bun run lint` exit 0, `tsc --noEmit` clean for owned files, dev server compiles (GET / 200).

## Files owned & replaced (stubs → full implementations, default exports kept)
- `src/components/fiberkar/operations-view.tsx`
- `src/components/fiberkar/fusion-view.tsx`
- `src/components/fiberkar/power-tests-view.tsx`

No other file was created or modified.

## Work Log
1. Read `worklog.md` (Task 1 contracts) + shared APIs: `@/lib/types`, `@/lib/labels`, `@/lib/persian`, `@/lib/localdb`, `@/store/app-store`, `primitives.tsx`, `photo-picker.tsx`, `photo-gallery.tsx`. Confirmed Dexie indexes (`createdAt` indexed on all 3 tables → `orderBy('createdAt').reverse()`).
2. Implemented the shared view pattern identically in all three views (helpers duplicated per file, since only owned files could be touched):
   - Filters: local state seeded from `params.projectId/routeId/boxId`, synced via `useEffect` on those params; 3 dismissible `FilterChip`s (X clears local override, cascading project→route→box); 3 Selects («همه …» = `NONE` sentinel) to change filters locally.
   - List: `useLiveQuery` filtered + createdAt desc; Loader2 spinner while `undefined`; `EmptyState` with «ثبت … جدید» action; `ItemCard`s with badges/meta (jalali dates via `formatJalali`, counts via `toFa`).
   - Row trailing `DropdownMenu` (dir=rtl on **root** — see fix note below) → ویرایش / حذف (`DropdownMenuItem variant="destructive"`); delete via `ConfirmDialog` destructive + `deleteXxxCascade` + `toast(messages.deleted)`.
   - Form Dialog: `dir="rtl"`, `max-w-lg`, `max-h-[85vh] overflow-y-auto`; controlled state object; Persian per-field errors under `Field`; busy-disabled save; on create → `createX` → switch dialog into edit-mode of created record (photo section becomes live) + `messages.saved`; on edit → `updateX` + close + `messages.updated`; cascade Selects (project reset→route reset→box), `ensureSelected()` keeps current selection present even if archived.
3. **operations-view**: fields title* / type (all `operationTypeLabels`, 'custom'→required customTypeLabel) / date* (JalaliDatePicker, default `todayISO()`) / status (default 'planned') / project* / route? / box? / مسئول (profile Select; on save `profileSnapshot` → assigneeProfileId/Name/Role; if the profile was deleted meanwhile, the previously stored snapshot is preserved — history integrity) / description / techSpecs. Hint under مسئول per spec. Card: title + type badge + status badge (`operationStatusVariants`) + jalali date + assignee(+role) + project/route/box names via live maps. Photo category mapped from type (`fusion|power_test|drop_cable|box_install→…`, else `other`).
4. **fusion-view**: fields project* / route? / box? / connectionId / fiberNumbers* (dir=ltr, «مثلاً 1,2,5-8») / tubeNumber / cableSpec / deviceModel / result (dir=ltr, placeholder «مثلاً 0.02 dB — فقط مقدار واقعی دستگاه») / fusionDate* / description. Info-note: «نتیجه صرفاً همان مقدار ثبت‌شده در محل است؛ مقدار ساختگی درج نمی‌شود.» Result stored verbatim (trim only). Card: اتصال/connectionId (or «فیوژن»), tube+cable subtitle, meta = تارها (toFa), نتیجه (verbatim, ltr, emphasized), باکس, تاریخ. Edit-mode photos: THREE `PhotoPickerButton`s (قبل از فیوژن / حین فیوژن / بعد از فیوژن, category `fusion`, link {projectId, routeId?, boxId?, fusionId}) + `PhotoGallery {fusionId}`.
5. **power-tests-view**: fields project* / route? / box? / location* / date* / value* (`NumberField`) / unit* (default dBm) / wavelengthNm (NumberField, unit nm) / deviceModel / مسئول (name-only snapshot — `PowerTest` type has **no** `assigneeRole`; hint adapted) / description. Validation: value required+finite; `unit==='mW' && value<=0` → «توان بر حسب mW باید بزرگ‌تر از صفر باشد» (negative dBm allowed). Live conversion chip under value/unit: `convertedPower(value, unit)` → «معادل محاسباتی: …» (dashed-border chip + Calculator icon, explicitly labeled محاسباتی; NEVER stored). Card: big value+unit (LTR), location, device, assignee, wavelength, باکس, تاریخ. Photo: «عکس صفحه دستگاه» (`power_test`, baseTitle «صفحه دستگاه») + `PhotoGallery {powerTestId}`.
6. Type fixes during QA (tsc): aliased lucide `Box as BoxIcon` (collision with `Box` entity type in all 3 files); moved `dir="rtl"` from `DropdownMenuContent` (not in its props type) to the `DropdownMenu` root (Radix Root propagates direction); removed `assigneeRole` from power-test form/save/card to match `PowerTest`/`PowerTestInput`.
7. Verified: `bun run lint` → exit 0, zero errors; `bunx tsc --noEmit` → zero errors in owned files (remaining project errors are in foundation/other agents' files, untouched per constraints); `dev.log` → compiled, GET / 200.

## Notes for next agents
- `DropdownMenuContent` in this shadcn version does NOT accept a `dir` prop (TS) — pass `dir="rtl"` to `<DropdownMenu>` root instead.
- `PowerTest` has no `assigneeRole` field — only `assigneeName` snapshot.
- `photo-gallery.tsx` has a pre-existing tsc error (`Photo` type not imported at line ~160) and `photo-picker.tsx` passes `dir` to `DropdownMenuContent` — foundation files, left untouched as instructed (eslint passes).
