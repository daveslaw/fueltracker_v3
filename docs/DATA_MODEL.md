# FuelTracker v3 — Data Model

## Overview

All tables live in the `public` schema on Supabase Postgres. Row-Level Security (RLS) is enabled on every table. Two helper functions underpin most policies:

- `is_owner()` — returns true if the calling user is an active owner
- `my_station_id()` — returns the station UUID assigned to the calling user

---

## Entity Groups

### 1. Users & Access

#### `auth.users` _(Supabase managed)_
Standard Supabase Auth table. Not directly modified.

#### `user_profiles`
Extends `auth.users` with application-level role and station assignment.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `user_id` | uuid → auth.users | Unique; cascades on delete |
| `role` | text | `'cashier'` \| `'supervisor'` \| `'owner'` |
| `station_id` | uuid → stations | Nullable; which station this user belongs to |
| `is_active` | boolean | Default true; set false to deactivate |
| `created_at` | timestamptz | |

**RLS:** Users read their own row. Owners read all rows.

---

### 2. Station Configuration

#### `fuel_grades`
Lookup table — seeded once, not modified at runtime.

| Column | Type | Notes |
|---|---|---|
| `id` | text PK | `'95'`, `'93'`, `'D10'`, `'D50'` |
| `label` | text | e.g. `'Petrol 95'`, `'Diesel 10ppm'` |

**RLS:** All authenticated users can read.

#### `product_catalogues`
Named product lists shared across stations that use the same supplier.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `name` | text not null | e.g. `'Total'`, `'Elegant'` |

**RLS:** Owners have full CRUD. Cashiers and supervisors can read.

#### `stations`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `name` | text | |
| `address` | text | Nullable |
| `catalogue_id` | uuid → product_catalogues | Nullable; which product catalogue this station uses |
| `created_at` | timestamptz | |

**RLS:** Owners have full CRUD. Supervisors/cashiers can read their own station.

#### `tanks`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `station_id` | uuid → stations | Cascades on delete |
| `label` | text | e.g. `'Tank 1 — 95'` |
| `fuel_grade_id` | text → fuel_grades | |
| `capacity_litres` | numeric(10,2) | Must be > 0 |
| `created_at` | timestamptz | |

**RLS:** Owners have full CRUD. Staff can read tanks at their station.

#### `pumps`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `station_id` | uuid → stations | Cascades on delete |
| `tank_id` | uuid → tanks | Which tank this pump draws from |
| `label` | text | e.g. `'Pump 1'` |
| `created_at` | timestamptz | |

**RLS:** Owners have full CRUD. Staff can read pumps at their station.

#### `products`
Dry stock items belonging to a product catalogue.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `catalogue_id` | uuid → product_catalogues not null | |
| `stock_code` | text | Nullable; supplier stock code |
| `description` | text not null | |
| `cost_price` | numeric(10,4) not null | ZAR; purchase price per unit |
| `sell_price` | numeric(10,4) not null | ZAR; selling price per unit |
| `is_active` | boolean not null | Default true; false hides from cashier forms |
| `created_at` | timestamptz | |

**RLS:** Owners have full CRUD. Cashiers and supervisors can read active products for their station's catalogue.

---

### 3. Pricing

#### `fuel_prices`
Per-station, per-grade versioned price log with date ranges. Each row covers one price window.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `station_id` | uuid → stations not null | |
| `fuel_grade_id` | text → fuel_grades | |
| `sell_price_per_litre` | numeric(8,4) not null | ZAR; must be > 0 |
| `cost_per_litre` | numeric(8,4) not null | ZAR; must be > 0 |
| `valid_from` | timestamptz not null | When this price became active |
| `valid_to` | timestamptz | Nullable; open-ended if null |
| `set_by` | uuid → auth.users | Nullable |
| `created_at` | timestamptz | |

**Active price lookup:** `station_id = shift.station_id AND fuel_grade_id = X AND valid_from <= shift.started_at AND (valid_to IS NULL OR valid_to > shift.started_at)`

**Constraint:** Overlapping ranges for the same `(station_id, fuel_grade_id)` are rejected at application level.

**RLS:** Owners have full CRUD. All authenticated users can read.

---

### 4. Shifts

#### `shifts`
One row per shift. Supports splitting for price changes via `part` and `shift_type`.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `station_id` | uuid → stations | |
| `supervisor_id` | uuid → user_profiles | Nullable; set when supervisor closes the shift |
| `cashier_id` | uuid → user_profiles | Nullable; cashier assigned to this shift |
| `period` | text | `'morning'` \| `'evening'` |
| `part` | smallint not null | `0` = no split; `1` = first of a split pair; `2` = second of a split pair. Default `0` |
| `shift_type` | text not null | `'standard'` \| `'price_change'`. Default `'standard'` |
| `shift_date` | date | |
| `started_at` | timestamptz not null | Set at shift creation; used for price lookups |
| `status` | text | `'pending'` \| `'closed'`; default `'pending'` |
| `is_flagged` | boolean | Default false; set by supervisor to flag a discrepancy |
| `flag_comment` | text | Nullable; required when `is_flagged = true` |
| `submitted_at` | timestamptz | Nullable; set at close time |
| `created_at` | timestamptz | |

**Unique constraint:** `(station_id, shift_date, period, part)` — allows multiple shifts per period when split.

**Display label:** Computed from `(period, part)` — not stored.
- `part = 0` → `"Morning"` / `"Evening"`
- `part = 1` → `"Morning Part 1"` / `"Evening Part 1"`
- `part = 2` → `"Morning Part 2"` / `"Evening Part 2"`

**Split logic:** When a second shift is opened for the same period, the application retroactively sets the first shift's `part` from `0` to `1`; the new shift opens with `part = 2`.

**State machine:**
```
pending → closed
```
`is_flagged` is a property on a closed shift, not a separate status.

**RLS:** Supervisors have full CRUD on shifts at their station. Cashiers can read shifts at their station. Owners can read all shifts.

---

### 5. Shift Close Readings

#### `pump_readings`
One row per pump per shift per type (open or close). Currently only close readings are captured.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `shift_id` | uuid → shifts | Cascades on delete |
| `pump_id` | uuid → pumps | |
| `type` | text | `'open'` \| `'close'` |
| `photo_url` | text | Nullable; Supabase Storage URL |
| `meter_reading` | numeric(12,2) | Nullable; cumulative meter value in litres |
| `ocr_status` | text | `'auto'` \| `'needs_review'` \| `'manual_override'` \| `'unreadable'` |
| `created_at` | timestamptz | |

**Unique constraint:** `(shift_id, pump_id, type)`

**RLS:** Supervisors have full CRUD on readings for their station's shifts. Owners can read all.

#### `dip_readings`
Tank dip level per tank per shift per type.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `shift_id` | uuid → shifts | Cascades on delete |
| `tank_id` | uuid → tanks | |
| `type` | text | `'open'` \| `'close'` |
| `litres` | numeric(10,2) | Must be ≥ 0 |
| `created_at` | timestamptz | |

**Unique constraint:** `(shift_id, tank_id, type)`

**RLS:** Same pattern as `pump_readings`.

---

### 6. POS Z-Report

#### `pos_submissions`
One per shift. Holds the Z-report photo and raw OCR output.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `shift_id` | uuid → shifts | Unique; cascades on delete |
| `photo_url` | text | Nullable; Supabase Storage URL |
| `raw_ocr` | jsonb | Nullable; full Vision API response stored for audit |
| `created_at` | timestamptz | |

**RLS:** Cashiers and supervisors can manage submissions for their station. Owners can read all.

#### `pos_submission_lines`
One row per fuel grade confirmed by the cashier or supervisor.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `pos_submission_id` | uuid → pos_submissions | Cascades on delete |
| `fuel_grade_id` | text → fuel_grades | |
| `litres_sold` | numeric(10,2) | Must be ≥ 0 |
| `revenue_zar` | numeric(12,2) | Must be ≥ 0 |
| `ocr_status` | text | `'auto'` \| `'manual_override'` \| `'unreadable'` |
| `created_at` | timestamptz | |

**Unique constraint:** `(pos_submission_id, fuel_grade_id)`

**RLS:** Same pattern as `pos_submissions`.

#### `pos_dry_stock_lines`
OCR-extracted product sales from the dry stock section of the Z-report.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `pos_submission_id` | uuid → pos_submissions | Cascades on delete |
| `product_id` | uuid → products | |
| `units_sold` | numeric(10,2) | |
| `revenue_zar` | numeric(14,2) | |
| `ocr_status` | text | `'auto'` \| `'manual_override'` \| `'unreadable'` |

**Unique constraint:** `(pos_submission_id, product_id)`

**RLS:** Cashiers and supervisors can manage for their station. Owners can read all.

---

### 7. Deliveries

#### `deliveries`
Fuel tanker deliveries recorded by supervisors. Used in reconciliation Formula 1.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `station_id` | uuid → stations | Cascades on delete |
| `tank_id` | uuid → tanks | Which tank received the delivery |
| `litres_received` | numeric(10,2) | Must be > 0 |
| `delivery_note_number` | text not null | Cross-reference to supplier documentation |
| `driver_name` | text | Nullable |
| `delivery_note_url` | text | Nullable; Supabase Storage URL for delivery note photo |
| `delivered_at` | timestamptz | Actual delivery time; determines which shift period it belongs to |
| `recorded_by` | uuid → user_profiles | Nullable |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

**Unique constraint:** `(station_id, delivery_note_number)` — prevents double-capture.

**Indexes:** `(station_id, delivered_at desc)`, `(tank_id, delivered_at desc)`

**RLS:** Supervisors have full CRUD on deliveries at their station. Owners have full CRUD across all stations.

#### `stock_deliveries`
Dry stock (product) deliveries received by the cashier during a shift.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `shift_id` | uuid → shifts | Cascades on delete |
| `station_id` | uuid → stations | |
| `product_id` | uuid → products | |
| `quantity` | numeric(10,2) not null | Units received |
| `recorded_by` | uuid → user_profiles | Nullable |
| `created_at` | timestamptz | |

**RLS:** Cashiers can insert for their station's open shift. Supervisors and owners can read.

---

### 8. Dry Stock Readings

#### `stock_readings`
Cashier's closing count per product per shift.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `shift_id` | uuid → shifts | Cascades on delete |
| `product_id` | uuid → products | |
| `closing_count` | numeric(10,2) not null | Units counted at shift end |
| `created_at` | timestamptz | |

**Unique constraint:** `(shift_id, product_id)`

**RLS:** Cashiers can insert/update for their station's open shift. Supervisors and owners can read.

---

### 9. Reconciliation

Computed automatically when a shift is closed. Re-runs if an override or delivery is saved after close.

#### `reconciliations`
Financial summary per shift.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `shift_id` | uuid → shifts | Unique; cascades on delete |
| `expected_revenue` | numeric(14,2) | POS litres × price per grade, summed |
| `pos_revenue` | numeric(14,2) | Revenue reported on Z-report |
| `revenue_variance` | numeric(14,2) | `expected_revenue − pos_revenue` |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | Updated on re-run |

**RLS:** Written by the service role only. Supervisors and owners can read.

#### `reconciliation_tank_lines`
Formula 1 result per tank.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `reconciliation_id` | uuid → reconciliations | Cascades on delete |
| `tank_id` | uuid → tanks | |
| `opening_dip` | numeric(10,2) | From prior closed shift or baseline |
| `deliveries_received` | numeric(10,2) | Sum of deliveries to this tank during the shift period |
| `pos_litres_sold` | numeric(10,2) | From `pos_submission_lines` for this tank's grade |
| `expected_closing_dip` | numeric(10,2) | `opening_dip + deliveries_received − pos_litres_sold` |
| `actual_closing_dip` | numeric(10,2) | Measured dip reading |
| `variance_litres` | numeric(10,2) | `expected − actual`; positive = loss |

**Unique constraint:** `(reconciliation_id, tank_id)`

#### `reconciliation_grade_lines`
Formula 2 result per fuel grade.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `reconciliation_id` | uuid → reconciliations | Cascades on delete |
| `fuel_grade_id` | text → fuel_grades | |
| `meter_delta` | numeric(10,2) | Sum of `(close − open)` meter readings across all pumps for this grade |
| `pos_litres_sold` | numeric(10,2) | From `pos_submission_lines` |
| `variance_litres` | numeric(10,2) | `meter_delta − pos_litres_sold` |

**Unique constraint:** `(reconciliation_id, fuel_grade_id)`

#### `reconciliation_stock_lines`
Dry stock variance per product per shift.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `reconciliation_id` | uuid → reconciliations | Cascades on delete |
| `product_id` | uuid → products | |
| `opening_count` | numeric(10,2) | From prior shift closing count or stock baseline |
| `deliveries_received` | numeric(10,2) | Sum of `stock_deliveries.quantity` for this product during the shift |
| `pos_units_sold` | numeric(10,2) | From `pos_dry_stock_lines` |
| `expected_closing_count` | numeric(10,2) | `opening_count + deliveries_received − pos_units_sold` |
| `actual_closing_count` | numeric(10,2) | From `stock_readings.closing_count` |
| `variance_units` | numeric(10,2) | `actual_closing_count − expected_closing_count`; negative = loss |
| `variance_zar` | numeric(14,2) | `variance_units × sell_price` (at product's current sell price) |

**Unique constraint:** `(reconciliation_id, product_id)`

**RLS (all reconciliation tables):** Written exclusively by the **service role** (server-side, bypasses RLS). Supervisors can read their station's records. Owners can read all.

---

### 10. Audit & Corrections

#### `ocr_overrides`
Audit trail for post-close value corrections by supervisors.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `shift_id` | uuid → shifts | Cascades on delete |
| `reading_id` | uuid | FK to `pump_readings.id` or `pos_submission_lines.id` |
| `reading_type` | text | `'pump'` \| `'pos_line'` |
| `original_value` | numeric(14,2) | Value before override |
| `override_value` | numeric(14,2) | Corrected value |
| `reason` | text | Required; supervisor explains the correction |
| `overridden_by` | uuid → user_profiles | |
| `created_at` | timestamptz | |

**Index:** `shift_id`

**RLS:** Supervisors can insert overrides for their station's shifts. Owners can insert and read all.

---

### 11. Baselines

#### `shift_baselines`
Owner-set initial readings used as the opening values for the very first shift at a station (when no prior closed shift exists to roll forward from).

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `station_id` | uuid → stations | |
| `pump_id` | uuid → pumps | Nullable; set for meter baselines |
| `tank_id` | uuid → tanks | Nullable; set for dip baselines |
| `reading_type` | text | `'meter'` \| `'dip'` |
| `value` | numeric(12,2) | Must be ≥ 0 |
| `set_at` | timestamptz | |
| `set_by` | uuid → user_profiles | Nullable |

**Constraint:** Either `pump_id` is set (and `reading_type = 'meter'`) or `tank_id` is set (and `reading_type = 'dip'`). Never both.

**Unique indexes:** One baseline per `(station_id, pump_id)` and one per `(station_id, tank_id)`.

**RLS:** Owners have full CRUD. Supervisors can read baselines for their station.

#### `stock_baselines`
Owner-set initial stock count per product per station, used when no prior closed shift exists.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `station_id` | uuid → stations | |
| `product_id` | uuid → products | |
| `quantity` | numeric(10,2) not null | Opening unit count |
| `set_at` | timestamptz | |
| `set_by` | uuid → user_profiles | Nullable |

**Unique constraint:** `(station_id, product_id)`

**RLS:** Owners have full CRUD. Cashiers and supervisors can read for their station.

---

### 12. Archive

#### `shifts_archive`
A snapshot of all shifts that existed before the shift redesign migration. Not used at runtime.

---

## Relationships Diagram

```
auth.users
  └─ user_profiles (role, station_id)

product_catalogues
  └─ products (cost_price, sell_price, is_active)

stations (catalogue_id → product_catalogues)
  ├─ tanks (fuel_grade_id → fuel_grades)
  │    └─ pumps
  ├─ shifts (supervisor_id, cashier_id → user_profiles; part, shift_type, started_at)
  │    ├─ pump_readings (pump_id → pumps)
  │    ├─ dip_readings (tank_id → tanks)
  │    ├─ pos_submissions
  │    │    ├─ pos_submission_lines (fuel_grade_id → fuel_grades)
  │    │    └─ pos_dry_stock_lines (product_id → products)
  │    ├─ stock_readings (product_id → products)
  │    ├─ stock_deliveries (product_id → products)
  │    ├─ reconciliations
  │    │    ├─ reconciliation_tank_lines (tank_id → tanks)
  │    │    ├─ reconciliation_grade_lines (fuel_grade_id → fuel_grades)
  │    │    └─ reconciliation_stock_lines (product_id → products)
  │    └─ ocr_overrides (overridden_by → user_profiles)
  ├─ deliveries (tank_id → tanks, recorded_by → user_profiles)
  ├─ shift_baselines (pump_id → pumps | tank_id → tanks)
  └─ stock_baselines (product_id → products)

fuel_grades (lookup, seeded)
fuel_prices (station_id → stations, fuel_grade_id → fuel_grades, set_by → auth.users)
```

---

## RLS Summary

| Table | Cashier | Supervisor | Owner |
|---|---|---|---|
| `user_profiles` | Read own | Read own | Read all |
| `stations` | Read own | Read own | Full CRUD |
| `tanks` | Read own station | Read own station | Full CRUD |
| `pumps` | Read own station | Read own station | Full CRUD |
| `fuel_grades` | Read | Read | Read |
| `fuel_prices` | Read | Read | Full CRUD |
| `product_catalogues` | Read | Read | Full CRUD |
| `products` | Read own station | Read own station | Full CRUD |
| `shifts` | Read own station | Full CRUD own station | Read all |
| `pump_readings` | — | Full CRUD own station | Read all |
| `dip_readings` | — | Full CRUD own station | Read all |
| `pos_submissions` | Full CRUD own station | Full CRUD own station | Read all |
| `pos_submission_lines` | Full CRUD own station | Full CRUD own station | Read all |
| `pos_dry_stock_lines` | Full CRUD own station | Read own station | Read all |
| `stock_readings` | Full CRUD own station | Read own station | Read all |
| `stock_deliveries` | Full CRUD own station | Read own station | Read all |
| `deliveries` | — | Full CRUD own station | Full CRUD all |
| `reconciliations` | — | Read own station | Read all |
| `reconciliation_tank_lines` | — | Read own station | Read all |
| `reconciliation_grade_lines` | — | Read own station | Read all |
| `reconciliation_stock_lines` | — | Read own station | Read all |
| `ocr_overrides` | — | Insert + read own station | Insert + read all |
| `shift_baselines` | — | Read own station | Full CRUD |
| `stock_baselines` | Read own station | Read own station | Full CRUD |

Reconciliation tables are written exclusively by the **service role** (server-side, bypasses RLS).
