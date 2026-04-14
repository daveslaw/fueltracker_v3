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
| `role` | text | `attendant` \| `supervisor` \| `owner` |
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
| `created_at` | timestamptz | |

**RLS:** Owners have full CRUD. Supervisors/staff can read their own station.

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

---

### 3. Pricing

#### `fuel_prices`
Append-only versioned price log. Each row is a price change event.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `fuel_grade_id` | text → fuel_grades | |
| `price_per_litre` | numeric(8,4) | ZAR; must be > 0 |
| `effective_from` | timestamptz | When this price became active |
| `set_by` | uuid → auth.users | Nullable |
| `created_at` | timestamptz | |

The active price for a shift is the latest row where `effective_from <= shift.submitted_at`.

**RLS:** Owners have full CRUD. All authenticated users can read.

---

### 4. Shifts

#### `shifts`
One row per shift. Shift slots are created by the owner; supervisors close them.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `station_id` | uuid → stations | |
| `supervisor_id` | uuid → user_profiles | Nullable; set when supervisor closes the shift |
| `attendant_id` | uuid → user_profiles | Nullable; retired field from previous model |
| `period` | text | `'morning'` \| `'evening'` |
| `shift_date` | date | |
| `status` | text | `'pending'` \| `'closed'`; default `'pending'` |
| `is_flagged` | boolean | Default false; set by supervisor to flag a discrepancy |
| `flag_comment` | text | Nullable; required when `is_flagged = true` |
| `submitted_at` | timestamptz | Nullable; set at close time — used for price lookups |
| `created_at` | timestamptz | |

**Unique constraint:** `(station_id, period, shift_date)` — one shift per station/period/day.

**State machine:**
```
pending → closed
```
`is_flagged` is a property on a closed shift, not a separate status.

**RLS:** Supervisors have full CRUD on shifts at their station. Owners can read all shifts.

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

**RLS:** Supervisors can manage submissions for their station. Owners can read all.

#### `pos_submission_lines`
One row per fuel grade confirmed by the supervisor.

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
| `delivery_note_url` | text | Nullable; Supabase Storage URL for delivery note photo |
| `delivered_at` | timestamptz | Actual delivery time; determines which shift period it belongs to |
| `recorded_by` | uuid → user_profiles | Nullable |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

**Indexes:** `(station_id, delivered_at desc)`, `(tank_id, delivered_at desc)`

**RLS:** Supervisors have full CRUD on deliveries at their station. Owners have full CRUD across all stations.

---

### 8. Reconciliation

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

**RLS (all reconciliation tables):** Written exclusively by the **service role** (server-side, bypasses RLS). Supervisors can read their station's records. Owners can read all.

---

### 9. Audit & Corrections

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

### 10. Baselines

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

---

### 11. Archive

#### `shifts_archive`
A snapshot of all shifts that existed before the shift redesign migration. Not used at runtime.

---

## Relationships Diagram

```
auth.users
  └─ user_profiles (role, station_id)

stations
  ├─ tanks (fuel_grade_id → fuel_grades)
  │    └─ pumps
  ├─ shifts (supervisor_id → user_profiles)
  │    ├─ pump_readings (pump_id → pumps)
  │    ├─ dip_readings (tank_id → tanks)
  │    ├─ pos_submissions
  │    │    └─ pos_submission_lines (fuel_grade_id → fuel_grades)
  │    ├─ reconciliations
  │    │    ├─ reconciliation_tank_lines (tank_id → tanks)
  │    │    └─ reconciliation_grade_lines (fuel_grade_id → fuel_grades)
  │    └─ ocr_overrides (overridden_by → user_profiles)
  ├─ deliveries (tank_id → tanks, recorded_by → user_profiles)
  └─ shift_baselines (pump_id → pumps | tank_id → tanks)

fuel_grades (lookup, seeded)
fuel_prices (fuel_grade_id → fuel_grades, set_by → auth.users)
```

---

## RLS Summary

| Table | Supervisor | Owner |
|---|---|---|
| `user_profiles` | Read own | Read all |
| `stations` | Read own | Full CRUD |
| `tanks` | Read own station | Full CRUD |
| `pumps` | Read own station | Full CRUD |
| `fuel_grades` | Read | Read |
| `fuel_prices` | Read | Full CRUD |
| `shifts` | Full CRUD own station | Read all |
| `pump_readings` | Full CRUD own station | Read all |
| `dip_readings` | Full CRUD own station | Read all |
| `pos_submissions` | Full CRUD own station | Read all |
| `pos_submission_lines` | Full CRUD own station | Read all |
| `deliveries` | Full CRUD own station | Full CRUD all |
| `reconciliations` | Read own station | Read all |
| `reconciliation_tank_lines` | Read own station | Read all |
| `reconciliation_grade_lines` | Read own station | Read all |
| `ocr_overrides` | Insert + read own station | Insert + read all |
| `shift_baselines` | Read own station | Full CRUD |

Reconciliation tables are written exclusively by the **service role** (server-side, bypasses RLS).
