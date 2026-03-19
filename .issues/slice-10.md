## Parent PRD

#2

## What to build

Build the Pricing module. Owner sets the selling price per fuel grade in ZAR per litre. All price changes are versioned and timestamped. The Reconciliation Engine always queries the price that was active at the time of shift submission, so historical reconciliations remain accurate when prices change.

## Acceptance criteria

- [ ] Table: `fuel_prices` with columns: id, grade, price_per_litre (ZAR), effective_from, set_by (user_id), created_at
- [ ] A new row is inserted on every price change; existing rows are never updated (append-only versioning)
- [ ] Owner can set a new price per grade from the admin screen
- [ ] Admin screen shows current price per grade and full price change history with timestamps and who made the change
- [ ] Reconciliation Engine queries `fuel_prices` using `effective_from <= shift.submitted_at ORDER BY effective_from DESC LIMIT 1` per grade
- [ ] Changing a price does NOT retroactively alter existing reconciliation records
- [ ] Unit test: reconciliation uses the price active at shift time, not the current price

## Blocked by

- Blocked by #12 (Slice 8: shift submission + reconciliation)

## User stories addressed

- User story 48
- User story 49
