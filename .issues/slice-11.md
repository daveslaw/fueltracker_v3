## Parent PRD

#2

## What to build

Build the Supervisor Review module. Supervisors see a list of submitted shifts at their station and can open any shift to view the full submission: all pump photos, confirmed meter readings, dip readings, POS photo, extracted sales lines, delivery records, and reconciliation results. Supervisors can approve or flag a shift. They can also override an OCR-confirmed value post-submission, with the override recorded in the audit trail and reconciliation re-running automatically.

## Acceptance criteria

- [ ] Table: `ocr_overrides` with columns: id, reading_id, reading_type (pump|pos_line), original_value, override_value, reason, overridden_by, created_at
- [ ] Supervisor sees a list of submitted shifts at their station: date, period, attendant name, submission time, reconciliation variance summary
- [ ] Supervisor can filter by status (submitted, approved, flagged)
- [ ] Shift detail view shows: all pump photos with meter readings (open + close), all dip readings (open + close), POS Z-report photo, confirmed sales lines, delivery records for the shift period, and reconciliation results for both formulas and financial
- [ ] Supervisor can approve a shift; status transitions to `approved`; shift readings become immutable
- [ ] Supervisor can flag a shift with a free-text comment; status transitions to `flagged`
- [ ] Supervisor can view all flagged shifts in a dedicated view
- [ ] Supervisor can override an OCR-confirmed pump reading or POS line value; override record created with reason; reconciliation re-runs
- [ ] Approved shifts: overrides still possible but require a reason; immutability applies to original readings, not overrides
- [ ] RLS: supervisor can only review shifts at their assigned station; owner can review all

## Blocked by

- Blocked by #12 (Slice 8: shift submission + reconciliation)
- Blocked by #13 (Slice 9: fuel deliveries)
- Blocked by #14 (Slice 10: pricing)

## User stories addressed

- User story 24
- User story 25
- User story 26
- User story 27
- User story 28
- User story 29
- User story 30
- User story 31
