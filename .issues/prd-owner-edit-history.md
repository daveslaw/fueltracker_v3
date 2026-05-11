## Problem Statement

Owners currently have two blockers on the shift history detail page:

1. **404 on every shift history detail view.** Navigating to Shift History → View returns a 404. The cause is a stale database join: the history detail page queries `user_profiles!attendant_id` to show who ran the shift, but migration 000010 (`shift_redesign`) replaced `attendant_id` with `supervisor_id` on the `shifts` table. The query silently fails, the shift record comes back null, and the page calls `notFound()`.

2. **No edit capability.** Even once the 404 is fixed, the history detail page is read-only. Owners need to flag shifts that need follow-up and correct OCR-extracted readings (pump meter, dip, POS lines) — the same operations supervisors can perform from the shift summary page. Currently those controls only exist under `/shift/[id]/close/summary/`, a route designed for the supervisor close workflow, not the owner's dashboard context.

## Solution

Fix the broken join and add flag/unflag and override correction forms directly to the owner's shift history detail page (`/dashboard/history/[id]`). After any edit action the owner stays on the same page (refreshed with updated data). The existing server actions (`flagShift`, `unflagShift`, `createOverride`) and business-logic guards (`canFlag`, `canOverride`) are reused without modification to their interfaces; they only need an additional `revalidatePath` call for the history route so the page reflects changes immediately.

## User Stories

1. As an owner, I want the shift history detail page to load without a 404, so that I can view shift data for any historical shift.
2. As an owner, I want to see the supervisor's name on the shift detail page, so that I know who ran the shift.
3. As an owner, I want to flag a closed shift with a comment, so that I can mark shifts that need follow-up by a supervisor.
4. As an owner, I want to unflag a previously flagged shift, so that I can clear flags once issues are resolved.
5. As an owner, I want to see the current flag comment when a shift is already flagged, so that I understand the reason before deciding to clear it.
6. As an owner, I want to correct a pump meter close reading on a closed shift, so that I can fix OCR extraction errors without involving a supervisor.
7. As an owner, I want to correct a dip reading on a closed shift, so that tank inventory variances reflect the true values.
8. As an owner, I want to correct a POS line (litres sold or revenue) on a closed shift, so that financial variances are accurate.
9. As an owner, I want each override correction to require a written reason, so that there is an audit trail explaining why a value was changed.
10. As an owner, I want reconciliation to re-run automatically after I save a correction, so that variance figures are updated immediately.
11. As an owner, I want to stay on the history detail page after submitting a flag or correction, so that I can review the updated data without navigating away.
12. As an owner, I want flag/override controls to appear only on closed shifts, so that I cannot accidentally mutate a shift still being worked on by a supervisor.
13. As an owner, I want to see the full override audit trail on the history detail page, so that I can review all corrections ever made to a shift.

## Implementation Decisions

### Bug Fix — Broken Join
- The shift query on the history detail page uses `user_profiles!attendant_id`. This must change to `user_profiles!supervisor_id` to match the current schema introduced in migration 000010.
- The display field should use `email` (consistent with the history list page) rather than `first_name`/`last_name`, since supervisor profiles may not have those fields populated.

### Flag / Unflag Controls
- Reuse `flagShift(shiftId, comment)` and `unflagShift(shiftId)` server actions from the shift actions module.
- Display a flag section only when `canFlag(shift.status)` returns true (i.e. shift is `closed`).
- If the shift is already flagged, show the current comment and a "Remove flag" button.
- If not flagged, show a textarea and a "Flag shift" button.
- Use inline `use server` function wrappers inside the page component — the same pattern used by the supervisor summary page.

### Override / Correction Forms
- Reuse `createOverride(shiftId, formData)` server action.
- Display a corrections section only when `canOverride(shift.status)` returns true.
- Corrections section contains collapsible `<details>`/`<summary>` entries — one per close pump reading, one per close dip reading, one per POS line.
- For pump and dip readings, the correction form captures: corrected value and reason.
- For POS lines, the form additionally captures which field is being corrected (`litres_sold` or `revenue_zar`).
- Dip readings query must include `id` (currently omitted), which is required as the `reading_id` for the override.
- Pump readings query must filter for `type = 'close'` when building correction forms (open readings are not correctable post-close).

### Revalidation
- `flagShift`, `unflagShift`, and `createOverride` currently call `revalidatePath` only for the supervisor summary path. Each must also call `revalidatePath('/dashboard/history/${shiftId}')` so the history detail page reflects changes immediately.

### No new routes, no new tables
- All data mutations go through existing server actions and existing DB tables (`shifts.is_flagged`, `shifts.flag_comment`, `ocr_overrides`, `pump_readings`, `dip_readings`, `pos_submission_lines`).
- No schema migrations required.

### UI placement on the history detail page
- Flag/unflag section: below the reconciliation block, above the override audit trail.
- Corrections section: below the flag/unflag section, above the override audit trail.
- Audit trail remains at the bottom.

### Access control
- The history detail page already restricts access to `role === 'owner'`. No additional role checks are needed on the server actions — they check shift status via `canFlag`/`canOverride`, which is sufficient.

## Testing Decisions

Good tests verify observable behaviour through the module's public interface, not internal implementation details. For this feature:

- `flagShift` / `unflagShift` — existing tests in `supervisor-review.test.ts` cover `canFlag`. No new unit tests needed for the action wrappers themselves; the actions are thin orchestration.
- `createOverride` — covered by existing patterns. The only behavioural change (additional `revalidatePath` call) is not unit-testable without mocking Next.js internals; skip.
- History detail page — this is a Server Component with no pure logic to unit-test in isolation. Testing is best done manually by navigating to `/dashboard/history/[id]` as an owner and verifying: page loads, flag/unflag works, corrections submit and update reconciliation, audit trail appears.

No new test files are required for this feature. The bug fix (join column rename) has no unit-test surface.

## Out of Scope

- Adding override or flag capability to pending shifts (guards intentionally prevent this).
- Owner ability to create or delete deliveries from the history page.
- Owner ability to re-submit or reopen a closed shift.
- Email/notification on flag to supervisor.
- Filtering or searching within the override audit trail.
- Any changes to the supervisor summary page (`/shift/[id]/close/summary`).

## Further Notes

- The `attendant_id` to `supervisor_id` migration (000010) was applied some time ago but the history detail page was never updated. The fix is a single-line change to the Supabase select query.
- The `canFlag` and `canOverride` guards in `lib/supervisor-review.ts` are role-agnostic (they check shift status only). This is by design — the role boundary is enforced at the page level by the `role !== 'owner'` redirect at the top of the history detail page.
- After this feature ships, owners have parity with supervisors for post-close corrections. The only supervisor-exclusive actions remaining are creating/submitting shifts and recording deliveries during the close workflow.
