# Scripts — Seed Data Guide

## Quick Start

```bash
# Generate SQL
python scripts/gen_seed_april_2026.py

# Dry-run first (catches FK/constraint errors, no data committed)
python scripts/gen_seed_april_2026.py --dry-run
# Then apply the dry-run output to Supabase and check for errors.

# Apply for real
# Paste scripts/seed_amaglug_april_2026.sql into the Supabase SQL editor.
```

---

## Known Gotchas

### 1. `auth.users.id` vs `user_profiles.id` — these are different UUIDs

| Column | References |
|---|---|
| `shifts.supervisor_id` | `user_profiles.id` |
| `deliveries.recorded_by` | `user_profiles.id` |
| `shift_baselines.set_by` | `user_profiles.id` |
| `stock_deliveries.recorded_by` | `auth.users.id` |
| `stock_readings.recorded_by` | `auth.users.id` |
| `fuel_prices.set_by` | `auth.users.id` |

**Rule:** Name constants `_USER_ID` (auth.users) and `_PROFILE_ID` (user_profiles). Never reuse one for the other.

---

### 2. Check constraint allowed values

| Table | Column | Allowed values |
|---|---|---|
| `pos_dry_stock_lines` | `ocr_status` | `'pending'`, `'extracted'`, `'confirmed'`, `'manual'`, `'failed'` — NOT `'auto'` |
| `shifts` | `part` | `1`, `2` |

**Rule:** Before writing any generator that touches a new table, grep the migrations for `CHECK` constraints on that table.

---

### 3. Split shifts and the unique constraint

Split shifts (two rows with the same station/date/period but `part=1` and `part=2`) require that the `shifts_station_period_date_unique` constraint be dropped first. Migration `20260518000001_fix_shifts_part_constraint.sql` drops it.

The generator emits this at the top of the SQL:
```sql
ALTER TABLE shifts DROP CONSTRAINT IF EXISTS shifts_station_period_date_unique;
```

---

### 4. Required INSERT order (topological)

Reference/lookup rows must exist before any table that FKs into them:

```
fuel_prices
products
  ↓
shift_baselines / stock_baselines
  ↓
shifts
  ↓
pump_readings / dip_readings / deliveries
  ↓
pos_submissions → pos_submission_lines
dry_stock_pos_submissions → pos_dry_stock_lines   ← FKs to products
  ↓
stock_deliveries / stock_readings                 ← FKs to products
  ↓
reconciliations
  ↓
reconciliation_tank_lines / reconciliation_grade_lines / reconciliation_stock_lines
```

**Rule:** If you add a new table, figure out its FK deps and slot it in the right place.

---

## Pre-generation Checklist

- [ ] Confirm all UUIDs (users, profiles, stations) against the live DB before writing the generator
- [ ] Read migrations for every new table you'll INSERT into — grep for `CHECK` constraints
- [ ] List every lookup/reference table whose rows must exist before dependent INSERTs (see order above)
- [ ] Add FK reference map as a docstring at the top of the generator

## Pre-apply Checklist

- [ ] Run with `--dry-run` first and apply the output — fix any errors before the real run
- [ ] Apply to a local/shadow instance before cloud (`supabase db reset` then apply)
- [ ] Verify row counts in the summary output match expectations
