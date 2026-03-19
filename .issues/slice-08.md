## Parent PRD

#2

## What to build

Build shift submission and the Reconciliation Engine. When an attendant submits a completed shift, the system validates all data is present, transitions the shift to `submitted`, and immediately runs both reconciliation formulas plus the financial calculation. Results are stored and visible to the attendant as a confirmation screen. This is the core business logic of the system.

## Acceptance criteria

- [ ] Tables: `reconciliations`, `reconciliation_tank_lines`, `reconciliation_grade_lines` created with migrations
- [ ] Shift submission guard: cannot submit without all closing pump readings, all closing dip readings, and a confirmed POS submission
- [ ] Shift transitions to `submitted` state on successful submission
- [ ] Reconciliation Engine runs server-side immediately on submission (not client-side)
- [ ] Formula 1 (per tank): Expected Closing Dip = Opening Dip + Deliveries in shift period − POS Litres Sold for that grade; Variance = Expected − Actual Closing Dip
- [ ] Formula 2 (per grade): Meter Delta = sum of (closing − opening) across all pumps for grade; Variance = Meter Delta − POS Litres Sold
- [ ] Financial: Expected Revenue = POS Litres Sold × Selling Price per grade at time of submission; Revenue Variance = Expected − POS Reported Revenue (ZAR)
- [ ] Reconciliation Engine is a pure function with no side effects; reads all inputs, writes one reconciliation record
- [ ] Attendant sees a confirmation screen after submission showing shift summary and reconciliation results
- [ ] Shift state machine unit tests: all valid and invalid transitions; submission guard rejects incomplete shifts
- [ ] Reconciliation Engine unit tests: all formulas with zero deliveries, zero sales, positive variance, negative variance, multi-pump multi-grade aggregation

## Blocked by

- Blocked by #10 (Slice 6: shift close)
- Blocked by #11 (Slice 7: POS Z-report)

## User stories addressed

- User story 18
- User story 19
