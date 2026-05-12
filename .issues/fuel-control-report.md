## Problem Statement

The owner currently tracks fuel inventory, sales, variance, and gross profit in a per-station Excel spreadsheet. The spreadsheet captures daily dip readings, fuel deliveries with note numbers and driver names, POS litres sold, a calculated "sales as per dips" figure, a daily variance, a running accumulated variance for the month, and gross profit per grade. The existing daily report page in FuelTracker shows a single day's shift reconciliation cards — it is not a management-level view and does not support month-long trend monitoring or accumulated variance tracking.

## Solution

Replace the existing daily report page at `/dashboard/reports` with a monthly fuel control report. The report shows the full calendar month for a selected station: one row per shift, grouped by fuel grade, with daily subtotal rows and a running month-to-date accumulated variance column. This replaces the owner's Excel spreadsheet as the primary operational fuel control view.

## User Stories

1. As an owner, I want to select a station and month from the fuel control report, so that I can view the complete month's operational data for that station in one screen.
2. As an owner, I want to navigate to the previous or next month using arrow controls, so that I can review historical months without using a date picker.
3. As an owner, I want to see the fuel control data organised into one section per fuel grade, so that I can read D10 and ULP95 data independently without horizontal scrolling.
4. As an owner, I want to see a row for each shift (morning and evening) within each grade section, so that I can identify which specific shift produced a variance.
5. As an owner, I want to see the shift's opening dip and closing dip in each row, so that I can verify the tank readings that drive the reconciliation.
6. As an owner, I want to see delivery information — delivery note number, driver name, and litres — inline on the shift row where the delivery occurred, so that I can correlate deliveries with dip movements without switching screens.
7. As an owner, I want to see both the POS litres sold and the dip-calculated litres sold side by side, so that I can independently verify each measurement and understand the source of a variance.
8. As an owner, I want to see the daily variance (POS litres minus dip-calculated litres) for each shift row, so that I can spot single-shift anomalies.
9. As an owner, I want to see a running month-to-date accumulated variance per grade, so that I can understand whether inventory loss is trending up or recovering over the month.
10. As an owner, I want to see a daily subtotal row beneath each pair of morning and evening shifts, so that I can assess the full day's performance in one figure.
11. As an owner, I want to see the gross profit (ZAR) per shift row calculated as `(sell_price − cost_price) × pos_litres_sold`, so that I can track per-shift and per-grade profitability.
12. As an owner, I want the GP calculation to use the fuel price that was active at the time the shift started, so that price changes during the month are reflected accurately.
13. As an owner, I want pending (not yet closed) shift rows to appear in the table with a pending badge and blank figures, so that I can see which shifts are still outstanding and understand why totals may be incomplete.
14. As an owner, I want to click the date or period cell of any closed shift row and navigate to that shift's history detail page, so that I can drill into full reconciliation detail, flag the shift, or review override history.
15. As an owner, I want the accumulated variance to reset to zero at the start of each month, so that each month's report is a self-contained view I can review at month-end.
16. As an owner, I want the month's opening dip to be sourced automatically from the last closing dip of the prior month's final shift, so that the report is always self-populating without manual data entry for the rolling baseline.
17. As an owner, I want the station selector to persist when I change months, so that I do not need to re-select my station each time I navigate.
18. As an owner, I want the report to display a message when no shifts exist for the selected month and station, so that I am not presented with an empty table without context.
19. As an owner, I want the monthly report to be accessible from the same URL as the existing daily report, so that my bookmarks and navigation muscle memory are preserved.

## Implementation Decisions

### Module: `lib/fuel-control-report.ts` (new)

This is the primary new deep module. It encapsulates all data assembly and business logic for the monthly fuel control report in a pure, testable interface that the page component consumes.

**Types:**

```ts
interface FuelControlShiftRow {
  shift_id:             string
  shift_date:           string          // YYYY-MM-DD
  period:               'morning' | 'evening'
  part:                 number          // 0 = no split; 1 or 2 = split shift
  status:               string          // 'pending' | 'closed'
  is_flagged:           boolean
  fuel_grade_id:        string
  opening_dip:          number | null   // null when shift is pending
  closing_dip:          number | null
  deliveries_litres:    number
  delivery_note:        string | null
  driver_name:          string | null
  pos_litres:           number | null
  dip_calc_litres:      number | null   // opening_dip + deliveries - closing_dip
  variance_litres:      number | null   // pos_litres - dip_calc_litres
  accumulated_variance: number | null
  sell_price:           number | null
  cost_price:           number | null
  gp_zar:              number | null   // (sell_price - cost_price) x pos_litres
}

interface FuelControlDaySubtotal {
  shift_date:        string
  fuel_grade_id:     string
  total_deliveries:  number
  total_pos_litres:  number | null
  total_dip_calc:    number | null
  total_variance:    number | null
  total_gp:         number | null
}

interface FuelControlMonthData {
  grades:    string[]                 // ordered list of grade IDs for this station
  rows:      FuelControlShiftRow[]
  subtotals: FuelControlDaySubtotal[]
}
```

**Pure functions (testable in isolation):**

- `buildFuelControlRows(inputs, prices)` — accepts raw shift + reconciliation + delivery data, returns `FuelControlShiftRow[]` with computed `dip_calc_litres`, `variance_litres`, `accumulated_variance` (running per grade), and `gp_zar`. Accumulated variance resets at month boundary (inputs are assumed to be one month's data sorted ascending by date + period).

- `buildDaySubtotals(rows)` — aggregates `FuelControlShiftRow[]` into one `FuelControlDaySubtotal` per `(shift_date, fuel_grade_id)`.

**Data fetch (server-only, not unit tested):**

- `getFuelControlMonth(db, stationId, year, month)` — fetches all shifts for the station + month, joins reconciliation_tank_lines (aggregated to grade level), deliveries (bucketed to shift period via `delivered_at`), pos_submission_lines, and fuel_prices. Returns raw inputs ready for `buildFuelControlRows`.

### Grade-level aggregation from tank-level data

Reconciliation data is stored at tank level (`reconciliation_tank_lines`). Each tank has a single `fuel_grade_id`. For stations with multiple tanks of the same grade (e.g., Amaglug D10 × 2), the query sums `opening_dip`, `actual_closing_dip`, `deliveries_received`, and `pos_litres_sold` across all tanks sharing the same grade within a shift before passing to the pure functions.

### Delivery bucketing

Deliveries are not foreign-keyed to shifts — they have a `delivered_at` timestamp and `tank_id`. To associate a delivery with a shift period for inline display, bucket by the shift's date and period boundaries (morning = 06:00–17:59, evening = 18:00–05:59+1). The delivery's `delivery_note_number` and `driver_name` are shown inline on the shift row. When a shift has multiple deliveries of the same grade in a period, concatenate note numbers.

### Pending shift rows

Shifts with `status = 'pending'` (no closed reconciliation) appear as rows with `null` for all computed figures. The `accumulated_variance` for the month skips null rows — the accumulator does not advance on pending rows.

### Price lookup

Use the existing `selectActivePriceAt(prices, shift.started_at)` from `lib/pricing.ts`. Both `sell_price_per_litre` and `cost_per_litre` are passed through to `FuelControlShiftRow`.

### Page: replace `/dashboard/reports/page.tsx`

The existing daily report page (single-day, single-station, card-per-shift) is replaced by the monthly fuel control view. Query params: `?station=` and `?month=YYYY-MM`. Default: current station (first station if unset), current month.

Navigation: prev/next month links update only the `month` param, preserving the `station` param.

Existing report links (Weekly, Monthly, Dry Stock, Deliveries) in the nav are preserved.

### Drill-down

Each closed shift row's date/period cell renders as a link to `/dashboard/history/[shift_id]`. The existing history detail page provides full Formula 1, Formula 2, override audit trail, and flag controls.

### No schema changes required

All data needed exists in current tables: `shifts`, `reconciliation_tank_lines`, `reconciliation_grade_lines`, `pos_submission_lines`, `deliveries`, `tanks`, `fuel_prices`. No migrations needed.

## Testing Decisions

Tests target the pure functions in `lib/fuel-control-report.ts` — these are the module's externally visible behaviour. The data fetch function (`getFuelControlMonth`) is not unit tested; it is a thin query layer with no branching logic.

**What makes a good test for this module:**
- Tests exercise `buildFuelControlRows` and `buildDaySubtotals` with fixture data — no mocking, no Supabase calls.
- Tests verify the output shape and computed values (accumulated variance, GP, dip-calc), not the internal implementation steps.
- Edge cases: pending shift rows (nulls do not advance accumulator), multi-tank grade aggregation (sums are correct), price change mid-month (correct price applied per shift).

**Prior art:** `__tests__/owner-reports.test.ts` — tests `buildFinancialLines` and `buildStationDayStatus` using the same fixture-function-assertion pattern. `__tests__/daily-fuel-report.test.ts` — tests the existing `buildDailyFuelReport` which is the direct predecessor to `buildFuelControlRows`.

**Test file:** `__tests__/fuel-control-report.test.ts`

## Out of Scope

- Month-opening baseline entry UI (owner manually confirming opening dip at month start) — deferred to a future slice.
- CSV / Excel export of the monthly fuel control report.
- Multi-station view (all stations on one page).
- Price change impact report.
- Inventory snapshot / opening stock valuation report.
- Parking income tracking (Truck Stop only; separate concern).

## Further Notes

- The existing `buildDailyFuelReport` function in `lib/owner-reports.ts` was written in anticipation of this feature but operates at daily granularity. The new `buildFuelControlRows` supersedes it at shift granularity. The old function can be removed if no other callsite uses it.
- The sign convention for variance follows the existing system: negative = loss (POS sold more than dips account for). Consistent with `reconciliation_tank_lines.variance_litres`.
- The report is owner-only. RLS on all source tables already enforces this.
- The accumulated variance resets per month based on the data window passed to `buildFuelControlRows` — no database state is needed for the reset.
