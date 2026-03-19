## Parent PRD

#2

## What to build

Build the Owner Dashboard and daily reports. The owner sees a cross-station status board for today's shifts, and can drill into a daily variance report per station covering tank inventory (Formula 1), pump-meter-vs-POS (Formula 2), and financial reconciliation. All three report types show ZAR values and litre variances clearly labelled.

## Acceptance criteria

- [ ] Owner dashboard: card per station showing today's morning and evening shift status (not started / open / submitted / approved / flagged)
- [ ] Dashboard updates without full page reload (polling or Supabase realtime)
- [ ] Daily variance report: selectable date and station
- [ ] Formula 1 section: per tank — opening dip, deliveries received, POS litres sold, expected closing dip, actual closing dip, variance (litres)
- [ ] Formula 2 section: per grade — sum of pump meter deltas, POS litres sold, variance (litres)
- [ ] Financial section: per grade — litres sold, price per litre (at shift time), expected revenue (ZAR), POS reported revenue (ZAR), variance (ZAR); totals row
- [ ] Positive variance (unexplained gain) and negative variance (loss) visually distinguished
- [ ] If a shift is not yet submitted for that date, report shows partial data with a clear indicator
- [ ] Owner can view daily report for any past date

## Blocked by

- Blocked by #15 (Slice 11: supervisor review)

## User stories addressed

- User story 35
- User story 36
- User story 37
- User story 38
