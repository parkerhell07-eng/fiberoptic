# Task 10-d — PDF export pipeline rework

Agent: pdf-pipeline agent (Z.ai Code)
Scope: `src/lib/pdf.ts` (full rework) + `src/components/fiberkar/reports-view.tsx` (adapt + fixes). No other files touched.

## Context used from previous agents
- worklog.md Tasks 1–9 (architecture, native bridge, APK, keyboard fix).
- Core-layer API changes: `getPhotoBlob` (photoBlobs table), `adaptiveNum`, `blobToReportDataUrl` (no thumb), `nativeShareOrSaveFile`/`sanitizeFileName`, `saveBlobToDisk` return values.

## Fixes (file:line)
| ID | Fix | Evidence |
|----|-----|----------|
| C1 | Tables split into per-row blocks; header repeats on every continuation page; fixed % widths + `table-layout:fixed`; `margin-top:-1px` continuous borders; `keepWithNext` orphan control | pdf.ts:159,171,273-278,662-695 (`paginate`), KEEP_MIN=96 |
| C2 | One page mounted in DOM at a time; `img.decode()` per page; canvas freed | pdf.ts:834-852 |
| H2 | Sort photos by createdAt BEFORE summary slice(0,8) | pdf.ts:775-781 |
| H3 | routes createdAt asc; boxes by route order + natural number compare; ops/fusions/powerTests/dropCables createdAt asc; Map lookups | pdf.ts:752-761, 283-292 |
| H4 | fonts.ready before measuring; flow-root wrapper includes margins | pdf.ts:803, 808-819 |
| H5 | Native share: no fallthrough to web path; 'failed' throws Persian error; results 'shared'/'saved'/'downloaded' toasted honestly | pdf.ts:884-891; reports-view.tsx:142-157 |
| H6 | mW via adaptiveNum; dBm 2 decimals | pdf.ts:498 |
| M1 | Real progress phases photos/measure/pages | pdf.ts ReportProgress; reports-view.tsx:309-327 |
| M3 | Summary routes table = 2 columns (no '—') | pdf.ts:363-370 |
| M4 | Photo stat = allPhotos.length; title «(درج‌شده: N)» | pdf.ts:347,610 |
| M5 | Box.capacity, Operation.assigneeRole, DropCable brand/model/coreCount/executor/مبدأ table, Fusion/PowerTest مسیر/باکس + description | pdf.ts:389,428,466-472,508-514,576-590 |
| M6 | sanitizeFileName in view + share fn | reports-view.tsx:129; pdf.ts:884 |
| M10 | Native: iframe skipped → file info (name/size/pages) + share | reports-view.tsx:355-385 |
| LOW | setProperties + setLanguage('fa'); esc single quotes; word-boundary longParagraphs; missing-photo note | pdf.ts:858-865,109,641-657,603-607 |

## E2E verification (agent-browser, isolated session `pdf10d`)
- Baseline full report (1 route): **۲ صفحه**. After seeding **42 boxes** into the app's real IndexedDB: **۴ صفحه** (1.2MB) → rows paginate, not clipped.
- Extracted the actual PDF blob from preview: `%PDF-1.3`, `/Count 4`.
- Pixel analysis of rendered pages: emerald repeated-header band at top of pages 2,3,4 (y≈69-94); ≥52 full-width row borders present (42 rows + header) → no row lost.
- Column counts in pixels: full routes=3/boxes=7; summary routes=2/boxes=5 (M3 proof).
- Summary: **۳ صفحه** (799KB). Web share → toast «گزارش دانلود شد»; file at `/home/z/Downloads/گزارش-پروژه آزمون PDF.pdf` (sanitized Persian name, md5 == preview blob).
- Console: zero errors (only pre-existing Radix aria-describedby warning).
- Cleanup: project deleted via UI cascade → IndexedDB all-zero; session closed; no test hacks committed.

## Gates
- `bunx tsc --noEmit` → 0 errors ✓ (one transient error from agent 10-c's in-flight CSV work appeared mid-session and was resolved on their side before final check)
- `bun run lint` → 0 errors, 0 warnings ✓
- E2E as above ✓

## Honest limits
- Android native share/save path verified by code + return contract only (no device/emulator in sandbox).
- Repeated header verified programmatically (pixel bands), not by human eyes.
- Single row taller than CONTENT_H (pathological multi-hundred-line cell) would still overflow — impossible to split a row without clipping; documented in code (pdf.ts:692-693).
