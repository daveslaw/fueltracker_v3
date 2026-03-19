## Parent PRD

#2

## What to build

Build weekly and monthly aggregate reports, the full shift history browser, drill-in shift audit view, and CSV export. This completes the reporting layer by extending the daily report data across longer time horizons and providing a searchable log of all historical shifts with full photo audit trails.

## Acceptance criteria

- [ ] Weekly report: aggregated variance and financial data per station for a selected ISO week; one row per day per station
- [ ] Monthly report: aggregated data per station for a selected month; one row per day per station; monthly totals row
- [ ] Shift history: owner can browse all shifts across all stations filtered by date range, station, shift period, attendant, and status
- [ ] Shift history row shows: date, station, period, attendant, submission time, approval status, variance summary
- [ ] Clicking a shift row opens the full shift audit view: all photos, meter readings, dip readings, POS photo + lines, overrides with reasons and who made them, reconciliation results
- [ ] Photos in audit view open full-screen on tap/click
- [ ] CSV export: daily/weekly/monthly report data downloadable as CSV; columns match on-screen report
- [ ] CSV filename includes station name and date range

## Blocked by

- Blocked by #16 (Slice 12: owner dashboard + daily reports)

## User stories addressed

- User story 39
- User story 40
- User story 41
- User story 43
