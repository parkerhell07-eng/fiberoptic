# Task 2-c — full-stack-developer — drop-cables + profiles views

## Scope (owned files)
- src/components/fiberkar/drop-cables-view.tsx
- src/components/fiberkar/profiles-view.tsx

## Contracts consumed (from Task 1 — read, not modified)
- @/store/app-store → params.projectId/routeId/boxId prefill, back()
- @/lib/types → DropCable, Profile, ProfileRole, ProfileRoleData, ConsumedResult
- @/lib/labels → installMethodLabels, installStatusLabels/Variants, deliveryStatusLabels/Variants, profileRoleLabels, messages
- @/lib/persian → toFa, formatNum, formatMeters, formatJalali, todayISO, computeConsumed, validateMeterage
- @/lib/localdb → db, createDropCable, updateDropCable, deleteDropCableCascade, createProfile, updateProfile, deleteProfileSafe, profileSnapshot, DropCableInput, ProfileInput
- @/components/fiberkar/primitives → PageHeader, EmptyState, StatCard, StatusBadge, ConfirmDialog, Field, NumberField, JalaliDatePicker, SegmentedTabs, ItemCard
- @/components/fiberkar/photo-picker + photo-gallery (edit mode only)

## Data-integrity decisions implemented
- consumedUser: stored exactly as typed (or undefined); NEVER derived/overwritten on edit.
- consumedAuto: recomputed on save ONLY when consumedUser is absent AND initial/returned valid AND returned<=initial (computeConsumed with user=undefined); otherwise cleared to undefined.
- Negative meterage blocked via validateMeterage on initialMeters/returnedMeters/consumedUser (+ coreCount sanity).
- returned > initial → hard Persian error «متراژ برگشتی نمی‌تواند بیشتر از متراژ اولیه باشد».
- List/stat consumed values rendered only when computeConsumed(...).valid, tagged «محاسباتی» or «واردشده توسط کاربر»; otherwise «—».
- Edit fallback: if executor profile was deleted, existing executorName snapshot is preserved on save (never silently erased).

## Status
- Implemented, lint clean (see worklog.md Task 2-c entry).
