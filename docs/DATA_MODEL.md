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
| `email` | text | Nullable; denormalised from auth.users for display |
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

#### `stations`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `name` | text | |
| `address` | text | Nullable |
| `stock_on_consignment` | boolean | Default false; informational only |
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
Dry stock items scoped directly to a station.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `station_id` | uuid → stations not null | |
| `stock_code` | text | Supplier stock code |
| `description` | text not null | |
| `is_active` | boolean not null | Default true; false hides from cashier forms |
| `created_at` | timestamptz | |

**RLS:** Owners have full CRUD. Cashiers and supervisors can read active products for their station.

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

#### `product_prices`
Per-product, per-station versioned cost/sell price log. Mirrors the `fuel_prices` versioning pattern.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `product_id` | uuid → products not null | |
| `station_id` | uuid → stations not null | |
| `cost_price` | numeric(10,2) not null | ZAR; must be ≥ 0 |
| `sell_price` | numeric(10,2) not null | ZAR; must be ≥ 0 |
| `valid_from` | timestamptz not null | |
| `valid_to` | timestamptz | Nullable; open-ended if null |
| `set_by` | uuid → auth.users | Nullable |
| `created_at` | timestamptz | |

**Index:** `(product_id, station_id, valid_from desc)` for active price lookup.

**RLS:** Owners have full CRUD. Cashiers and supervisors can read for their station.

---

### 4. Shifts

#### `shifts`
One row per shift. Supports splitting for price changes via `part` and `shift_type`.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `station_id` | uuid → stations | |
| `supervisor_id` | uuid → user_profiles | Nullable; set when supervisor closes the shift |
| `attendant_id` | uuid → user_profiles | Nullable; retained for schema hygiene, retired in shift redesign |
| `period` | text | `'morning'` \| `'evening'` |
| `part` | smallint not null | `0` = no split; `1` = first of a split pair; `2` = second. Default `0` |
| `shift_type` | text not null | `'standard'` \| `'price_change'`. Default `'standard'` |
| `shift_date` | date | |
| `started_at` | timestamptz not null | Set at shift creation; used for price lookups |
| `status` | text | `'pending'` \| `'closed'`; default `'pending'` |
| `is_flagged` | boolean | Default false |
| `flag_comment` | text | Nullable; required when `is_flagged = true` |
| `submitted_at` | timestamptz | Nullable; set when supervisor closes |
| `cashier_submitted_at` | timestamptz | Nullable; set when cashier submits their side |
| `has_manual_entry` | boolean | Default false; set true when any reading is saved with non-auto OCR status; write-once, never reset |
| `created_at` | timestamptz | |

**Unique constraint:** `(station_id, shift_date, period, part)`

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

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `shift_id` | uuid → shifts | Cascades on delete |
| `pump_id` | uuid → pumps | |
| `type` | text | `'open'` \| `'close'` |
| `photo_url` | text | Nullable |
| `meter_reading` | numeric(12,2) | Nullable; cumulative meter value in litres |
| `ocr_status` | text | `'auto'` \| `'needs_review'` \| `'manual_override'` \| `'unreadable'` |
| `maintenance_required` | boolean | Default false; set on close readings when pump needs attention |
| `created_at` | timestamptz | |

**Unique constraint:** `(shift_id, pump_id, type)`

**RLS:** Supervisors have full CRUD on readings for their station's shifts. Owners can read all.

#### `dip_readings`

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

### 6. POS Z-Report (Fuel)

#### `pos_submissions`
One per shift. Holds the fuel Z-report photo and raw OCR output.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `shift_id` | uuid → shifts | Unique; cascades on delete |
| `photo_url` | text | Nullable |
| `raw_ocr` | jsonb | Nullable; full Vision API response stored for audit |
| `created_at` | timestamptz | |

**RLS:** Cashiers and supervisors can manage submissions for their station. Owners can read all.

#### `pos_submission_lines`
One row per pump confirmed by the cashier or supervisor. Grade is derived via pump → tank → `fuel_grade_id`.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `pos_submission_id` | uuid → pos_submissions | Cascades on delete |
| `pump_id` | uuid → pumps | Which pump dispensed this fuel |
| `litres_sold` | numeric(10,2) | Must be ≥ 0 |
| `revenue_zar` | numeric(12,2) | Must be ≥ 0 |
| `ocr_status` | text | `'auto'` \| `'manual_override'` \| `'unreadable'` |
| `created_at` | timestamptz | |

**Unique constraint:** `(pos_submission_id, pump_id)`

**RLS:** Same pattern as `pos_submissions`.

---

### 7. POS Z-Report (Dry Stock)

#### `dry_stock_pos_submissions`
One per shift. Holds the dry stock Z-report photo and OCR status. Separate from the fuel `pos_submissions`.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `shift_id` | uuid → shifts | Unique; cascades on delete |
| `photo_url` | text | Nullable |
| `ocr_status` | text | `'pending'` \| `'extracted'` \| `'confirmed'` \| `'manual'` \| `'failed'` |
| `created_at` | timestamptz | |

**RLS:** Cashiers can insert/update for their station's shifts. All station staff can read.

#### `pos_dry_stock_lines`
OCR-extracted product sales from the dry stock Z-report.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `dry_stock_pos_submission_id` | uuid → dry_stock_pos_submissions | Cascades on delete |
| `product_id` | uuid → products | |
| `units_sold` | numeric(10,3) | |
| `revenue_zar` | numeric(14,2) | |
| `ocr_status` | text | `'auto'` \| `'manual_override'` \| `'unreadable'` |

**Unique constraint:** `(dry_stock_pos_submission_id, product_id)`

**RLS:** Cashiers can insert for their station. All station staff and owners can read.

---

### 8. Deliveries

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
| `delivery_note_url` | text | Nullable; Supabase Storage URL |
| `delivered_at` | timestamptz | Actual delivery time; determines which shift period it belongs to |
| `recorded_by` | uuid → user_profiles | Nullable |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

**Unique constraint:** `(station_id, delivery_note_number)`

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
| `quantity` | numeric(10,3) not null | Units received |
| `recorded_by` | uuid → auth.users | Nullable |
| `created_at` | timestamptz | |

**RLS:** Cashiers can insert/delete for their station. All station staff can read.

---

### 9. Dry Stock Readings

#### `stock_readings`
Cashier's closing count per product per shift.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `shift_id` | uuid → shifts | Cascades on delete |
| `product_id` | uuid → products | |
| `closing_count` | numeric(10,3) not null | Units counted at shift end |
| `recorded_by` | uuid → auth.users | Nullable |
| `created_at` | timestamptz | |

**Unique constraint:** `(shift_id, product_id)`

**RLS:** Cashiers can insert/update for their station's open shift. Supervisors and owners can read.

---

### 10. Reconciliation

Computed automatically when a shift is closed. Re-runs if an override or delivery is saved after close.

#### `reconciliations`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `shift_id` | uuid → shifts | Unique; cascades on delete |
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
| `deliveries_received` | numeric(10,2) | Sum of deliveries to this tank during the shift |
| `meter_delta` | numeric(10,2) | Sum of pump meter deltas for this tank's grade |
| `expected_closing_dip` | numeric(10,2) | `opening_dip + deliveries_received − meter_delta` |
| `actual_closing_dip` | numeric(10,2) | Measured dip reading |
| `variance_litres` | numeric(10,2) | `actual − expected`; negative = loss |

**Unique constraint:** `(reconciliation_id, tank_id)`

#### `reconciliation_pump_lines`
Formula 2 result per pump. Grade is denormalised from pump → tank.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `reconciliation_id` | uuid → reconciliations | Cascades on delete |
| `pump_id` | uuid → pumps | |
| `fuel_grade_id` | text → fuel_grades | Denormalised from pump → tank |
| `meter_delta_litres` | numeric(10,2) | `closing_reading − opening_reading` for this pump |
| `pos_litres_sold` | numeric(10,2) | From `pos_submission_lines` for this pump |
| `variance_litres` | numeric(10,2) | `pos_litres_sold − meter_delta_litres`; negative = unrecorded dispensing |
| `sell_price_per_litre` | numeric(8,4) | Price at shift start |
| `expected_revenue_zar` | numeric(14,2) | `meter_delta_litres × sell_price_per_litre` |
| `pos_revenue_zar` | numeric(14,2) | Revenue from POS Z-report for this pump |
| `variance_zar` | numeric(14,2) | `pos_revenue_zar − expected_revenue_zar`; negative = shortfall |

**Unique constraint:** `(reconciliation_id, pump_id)`

#### `reconciliation_stock_lines`
Dry stock variance per product per shift.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `reconciliation_id` | uuid → reconciliations | Cascades on delete |
| `product_id` | uuid → products | |
| `opening_count` | numeric(10,3) | From prior shift closing count or stock baseline |
| `deliveries_received` | numeric(10,3) | Sum of `stock_deliveries.quantity` for this product |
| `pos_units_sold` | numeric(10,3) | From `pos_dry_stock_lines` |
| `expected_closing_count` | numeric(10,3) | `opening_count + deliveries_received − pos_units_sold` |
| `actual_closing_count` | numeric(10,3) | From `stock_readings.closing_count` |
| `variance_units` | numeric(10,3) | `actual − expected`; negative = loss |
| `variance_zar` | numeric(14,2) | `variance_units × sell_price` |

**Unique constraint:** `(reconciliation_id, product_id)`

**RLS (all reconciliation tables):** Written exclusively by the **service role**. Supervisors can read their station's records. Owners can read all.

---

### 11. Audit & Corrections

#### `ocr_overrides`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `shift_id` | uuid → shifts | Cascades on delete |
| `reading_id` | uuid | FK to the overridden row in its source table |
| `reading_type` | text | `'pump'` \| `'dip'` \| `'pos_line'` \| `'dry_stock_line'` \| `'stock_reading'` |
| `field_name` | text | Nullable; for `pos_line` overrides: `'litres_sold'` or `'revenue_zar'` |
| `pump_id` | uuid → pumps | Nullable; set for `pos_line` overrides to identify the pump |
| `original_value` | numeric(14,2) | Value before override |
| `override_value` | numeric(14,2) | Corrected value |
| `reason` | text | Required |
| `overridden_by` | uuid → user_profiles | |
| `created_at` | timestamptz | |

**RLS:** Supervisors can insert overrides for their station's shifts. Owners can insert and read all.

---

### 12. Baselines

#### `shift_baselines`
Owner-set initial readings used as the opening values for the very first shift at a station.

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

**Constraint:** Either `pump_id` (meter) or `tank_id` (dip) is set — never both.

**Unique indexes:** One baseline per `(station_id, pump_id)` and one per `(station_id, tank_id)`.

**RLS:** Owners have full CRUD. Supervisors can read baselines for their station.

#### `stock_baselines`
Owner-set initial stock count per product per station.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `station_id` | uuid → stations | |
| `product_id` | uuid → products | |
| `quantity` | numeric(10,3) not null | Opening unit count |
| `set_at` | timestamptz | |
| `set_by` | uuid → user_profiles | Nullable |

**Unique constraint:** `(station_id, product_id)`

**RLS:** Owners have full CRUD. Cashiers and supervisors can read for their station.

---

## Relationships Diagram

```
auth.users
  └─ user_profiles (role, station_id)

stations
  ├─ tanks (fuel_grade_id → fuel_grades)
  │    └─ pumps
  ├─ products (is_active)
  │    └─ product_prices (cost_price, sell_price, valid_from, valid_to)
  ├─ shifts (supervisor_id, attendant_id → user_profiles; part, shift_type, started_at)
  │    ├─ pump_readings (pump_id → pumps)
  │    ├─ dip_readings (tank_id → tanks)
  │    ├─ pos_submissions
  │    │    └─ pos_submission_lines (fuel_grade_id → fuel_grades)
  │    ├─ dry_stock_pos_submissions
  │    │    └─ pos_dry_stock_lines (product_id → products)
  │    ├─ stock_readings (product_id → products)
  │    ├─ stock_deliveries (product_id → products)
  │    ├─ reconciliations
  │    │    ├─ reconciliation_tank_lines (tank_id → tanks)
  │    │    ├─ reconciliation_pump_lines (pump_id → pumps; fuel_grade_id denormalised)
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
| `products` | Read own station | Read own station | Full CRUD |
| `product_prices` | Read own station | Read own station | Full CRUD |
| `shifts` | Read own station | Full CRUD own station | Read all |
| `pump_readings` | — | Full CRUD own station | Read all |
| `dip_readings` | — | Full CRUD own station | Read all |
| `pos_submissions` | Full CRUD own station | Full CRUD own station | Read all |
| `pos_submission_lines` | Full CRUD own station | Full CRUD own station | Read all |
| `dry_stock_pos_submissions` | Insert/Update own station | Read own station | Read all |
| `pos_dry_stock_lines` | Insert own station | Read own station | Read all + Update |
| `stock_readings` | Full CRUD own station | Read own station | Read all + Update |
| `stock_deliveries` | Insert/Delete own station | Read own station | Read all |
| `deliveries` | — | Full CRUD own station | Full CRUD all |
| `reconciliations` | — | Read own station | Read all |
| `reconciliation_tank_lines` | — | Read own station | Read all |
| `reconciliation_pump_lines` | — | Read own station | Read all |
| `reconciliation_stock_lines` | — | Read own station | Read all |
| `ocr_overrides` | — | Insert + read own station | Insert + read all |
| `shift_baselines` | — | Read own station | Full CRUD |
| `stock_baselines` | Read own station | Read own station | Full CRUD |

Reconciliation tables are written exclusively by the **service role** (server-side, bypasses RLS).
