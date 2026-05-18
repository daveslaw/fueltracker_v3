#!/usr/bin/env python3
"""
Generator for seed_amaglug_april_2026.sql
Produces a complete, math-verified SQL seed for Elegant Amaglug, April 2026.

FK reference map:
  shifts.supervisor_id          → user_profiles.id  → SUPERVISOR_PROFILE_ID
  deliveries.recorded_by        → user_profiles.id  → SUPERVISOR_PROFILE_ID
  shift_baselines.set_by        → user_profiles.id  → OWNER_PROFILE_ID
  stock_deliveries.recorded_by  → auth.users.id     → CASHIER_USER_ID
  stock_readings.recorded_by    → auth.users.id     → CASHIER_USER_ID
  fuel_prices.set_by            → auth.users.id     → OWNER_USER_ID
"""

from decimal import Decimal, ROUND_HALF_UP
import datetime
import sys
from collections import defaultdict

DRY_RUN = "--dry-run" in sys.argv

OUT = "c:/Users/David Lawrence/Projects/fueltracker_v3/scripts/seed_amaglug_april_2026.sql"

# ── identity constants ────────────────────────────────────────────────────────

STATION_ID = "a1000000-0000-0000-0000-000000000001"

OWNER_USER_ID      = "e898e788-2166-4013-9f4f-430d4dded481"   # auth.users
OWNER_PROFILE_ID   = "00000000-0000-0000-0001-000000000001"   # user_profiles

SUPERVISOR_USER_ID    = "291cd71b-8c5b-4986-b806-73ff97d0527d"  # auth.users
SUPERVISOR_PROFILE_ID = "00000000-0000-0000-0001-000000000002"  # user_profiles

CASHIER_USER_ID    = "616533c7-1c1e-4c45-be3a-7fc403f0dfd5"   # auth.users
CASHIER_PROFILE_ID = "aa317ec2-2570-4636-b28a-bdf27b74b83b"   # user_profiles

# ── station config ────────────────────────────────────────────────────────────

TANK_IDS = {
    1: "a1100000-0000-0000-0000-000000000001",  # 95,  cap 30000
    2: "a1100000-0000-0000-0000-000000000002",  # D10, cap 31000
    3: "a1100000-0000-0000-0000-000000000003",  # D10, cap 31000
}
TANK_CAPS  = {1: 30000, 2: 31000, 3: 31000}
TANK_GRADE = {1: "95",  2: "D10", 3: "D10"}

def pump_uuid(n):
    return f"a1200000-0000-0000-0000-{n:012d}"

# Pumps 1-6 → Tank 1 (95); Pumps 7-12 → Tank 2 (D10); Pumps 13-18 → Tank 3 (D10)
PUMP_TANK = {**{p: 1 for p in range(1, 7)},
             **{p: 2 for p in range(7, 13)},
             **{p: 3 for p in range(13, 19)}}

# ── dry stock ─────────────────────────────────────────────────────────────────

PRODUCT_IDS = {
    "redbull":  "d3c8aae7-3eab-4ef3-83da-384070e2de4e",
    "monster":  "432bff73-3582-4b9d-927d-83e1bf1d59a0",
    "simba":    "f0b164fc-d98d-4508-9e15-81fa996de690",
    "lays":     "3badf356-7c90-457d-8192-65574a913438",
    "fanta":    "d55e3df4-30b6-477b-afd0-6a379b4cdebe",
    "coke":     "80eeb5f9-c164-4d9b-af2a-0865f284caa4",
    "castrol":  "6a72af88-c866-4971-844c-18b397f27f79",
    "lucky":    "3840e17f-55d2-4b57-87bf-76078b37a334",
    "cadbury":  "0a9da134-cec0-4e52-bd2b-4b6e7a833cc1",
    "stimorol": "b3fac55a-8095-45f9-a137-57ee45570dab",
}
PRODUCT_PRICE = {
    "redbull":  Decimal("35.00"),
    "monster":  Decimal("42.00"),
    "simba":    Decimal("13.99"),
    "lays":     Decimal("12.99"),
    "fanta":    Decimal("22.99"),
    "coke":     Decimal("24.99"),
    "castrol":  Decimal("129.99"),
    "lucky":    Decimal("64.99"),
    "cadbury":  Decimal("34.99"),
    "stimorol": Decimal("14.99"),
}
PRODUCTS = list(PRODUCT_IDS.keys())

# ── fuel prices ───────────────────────────────────────────────────────────────

PRICE_OLD = {"95": Decimal("22.4800"), "D10": Decimal("19.7800")}
PRICE_NEW = {"95": Decimal("22.9500"), "D10": Decimal("20.1500")}
PRICE_CHANGE_UTC = datetime.datetime(2026, 4, 15, 18, 0, 0)

# ── pump deltas (litres per pump per shift) ───────────────────────────────────
# 95 pumps (1-6): ~82-85L each.  D10 pumps (7-18): ~39-41L each.
# Delivery schedule:
#   Tank 1 (95): 18,000L start, +12,000 Day 3 morn, +10,000 Day 18 morn
#   Tank 2 (D10): 15,000L start, +10,000 Day 10 morn
#   Tank 3 (D10): 14,500L start, +9,000 Day 25 morn  ← binding 48-shift constraint

PUMP_DELTAS = {
    1:  (Decimal("82.00"), Decimal("87.00")),
    2:  (Decimal("80.00"), Decimal("85.00")),
    3:  (Decimal("84.00"), Decimal("89.00")),
    4:  (Decimal("81.00"), Decimal("86.00")),
    5:  (Decimal("83.00"), Decimal("88.00")),
    6:  (Decimal("80.00"), Decimal("85.00")),
    7:  (Decimal("40.00"), Decimal("43.00")),
    8:  (Decimal("39.00"), Decimal("42.00")),
    9:  (Decimal("41.00"), Decimal("44.00")),
    10: (Decimal("38.00"), Decimal("41.00")),
    11: (Decimal("40.00"), Decimal("43.00")),
    12: (Decimal("39.00"), Decimal("42.00")),
    13: (Decimal("40.00"), Decimal("43.00")),
    14: (Decimal("39.00"), Decimal("42.00")),
    15: (Decimal("41.00"), Decimal("44.00")),
    16: (Decimal("38.00"), Decimal("41.00")),
    17: (Decimal("40.00"), Decimal("43.00")),
    18: (Decimal("39.00"), Decimal("42.00")),
}

PUMP_BASELINES = {
    1:  Decimal("50000.00"), 2:  Decimal("50150.00"), 3:  Decimal("50300.00"),
    4:  Decimal("50450.00"), 5:  Decimal("50600.00"), 6:  Decimal("50750.00"),
    7:  Decimal("50050.00"), 8:  Decimal("50200.00"), 9:  Decimal("50350.00"),
    10: Decimal("50500.00"), 11: Decimal("50650.00"), 12: Decimal("50800.00"),
    13: Decimal("50100.00"), 14: Decimal("50250.00"), 15: Decimal("50400.00"),
    16: Decimal("50550.00"), 17: Decimal("50700.00"), 18: Decimal("50850.00"),
}

TANK_BASELINES = {1: Decimal("18000.00"), 2: Decimal("15000.00"), 3: Decimal("14500.00")}

# ── dry stock sales schedule ──────────────────────────────────────────────────

DAILY_UNITS = {
    "redbull": 18, "monster": 12, "simba": 25, "lays": 20,
    "fanta": 8,    "coke": 10,    "castrol": 3, "lucky": 15,
    "cadbury": 22, "stimorol": 30,
}
MORNING_UNITS = {k: int(v * 0.6) for k, v in DAILY_UNITS.items()}
EVENING_UNITS = {k: DAILY_UNITS[k] - MORNING_UNITS[k] for k in DAILY_UNITS}

STOCK_START = {
    "redbull": Decimal("144"), "monster": Decimal("96"),  "simba":    Decimal("200"),
    "lays":    Decimal("160"), "fanta":   Decimal("40"),  "coke":     Decimal("80"),
    "castrol": Decimal("36"),  "lucky":   Decimal("120"), "cadbury":  Decimal("176"),
    "stimorol": Decimal("240"),
}

# Weekly dry-stock deliveries. Each entry: (day, period, product, qty)
STOCK_DELIVERY_SCHEDULE = [
    (5,  "morning", "fanta",    Decimal("56")),
    (8,  "morning", "redbull",  Decimal("126")),
    (8,  "morning", "monster",  Decimal("84")),
    (8,  "morning", "simba",    Decimal("175")),
    (8,  "morning", "lays",     Decimal("140")),
    (8,  "morning", "fanta",    Decimal("56")),
    (8,  "morning", "coke",     Decimal("70")),
    (8,  "morning", "lucky",    Decimal("105")),
    (8,  "morning", "cadbury",  Decimal("154")),
    (8,  "morning", "stimorol", Decimal("210")),
    (15, "morning", "redbull",  Decimal("126")),
    (15, "morning", "monster",  Decimal("84")),
    (15, "morning", "simba",    Decimal("175")),
    (15, "morning", "lays",     Decimal("140")),
    (15, "morning", "fanta",    Decimal("56")),
    (15, "morning", "coke",     Decimal("70")),
    (15, "morning", "castrol",  Decimal("21")),
    (15, "morning", "lucky",    Decimal("105")),
    (15, "morning", "cadbury",  Decimal("154")),
    (15, "morning", "stimorol", Decimal("210")),
    (22, "morning", "redbull",  Decimal("126")),
    (22, "morning", "monster",  Decimal("84")),
    (22, "morning", "simba",    Decimal("175")),
    (22, "morning", "lays",     Decimal("140")),
    (22, "morning", "fanta",    Decimal("56")),
    (22, "morning", "coke",     Decimal("70")),
    (22, "morning", "castrol",  Decimal("21")),
    (22, "morning", "lucky",    Decimal("105")),
    (22, "morning", "cadbury",  Decimal("154")),
    (22, "morning", "stimorol", Decimal("210")),
    (29, "morning", "redbull",  Decimal("36")),
    (29, "morning", "monster",  Decimal("24")),
    (29, "morning", "simba",    Decimal("50")),
    (29, "morning", "lays",     Decimal("40")),
    (29, "morning", "fanta",    Decimal("16")),
    (29, "morning", "coke",     Decimal("20")),
    (29, "morning", "castrol",  Decimal("12")),
    (29, "morning", "lucky",    Decimal("30")),
    (29, "morning", "cadbury",  Decimal("44")),
    (29, "morning", "stimorol", Decimal("60")),
]
STOCK_DELIVERY_LOOKUP = {(_d, _p, _prod): _qty for _d, _p, _prod, _qty in STOCK_DELIVERY_SCHEDULE}

# Fuel deliveries: (day, tank_num, litres, note, driver)
FUEL_DELIVERIES = [
    (3,  1, Decimal("12000.00"), "DEL-2604-001", "Sipho Dlamini"),
    (10, 2, Decimal("10000.00"), "DEL-2604-002", "Thabo Nkosi"),
    (18, 1, Decimal("10000.00"), "DEL-2604-003", "Sipho Dlamini"),
    (25, 3, Decimal("9000.00"),  "DEL-2604-004", "Thabo Nkosi"),
]

# ── helpers ───────────────────────────────────────────────────────────────────

D2 = lambda x: Decimal(str(x)).quantize(Decimal("0.01"),   rounding=ROUND_HALF_UP)
D3 = lambda x: Decimal(str(x)).quantize(Decimal("0.001"),  rounding=ROUND_HALF_UP)
D4 = lambda x: Decimal(str(x)).quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)

def q(s):
    if s is None:
        return "NULL"
    return "'" + str(s).replace("'", "''") + "'"

def get_fuel_price(grade, submitted_at_str):
    dt = datetime.datetime.fromisoformat(submitted_at_str.replace("+00", "").strip())
    return PRICE_NEW[grade] if dt > PRICE_CHANGE_UTC else PRICE_OLD[grade]

# ── build shift list ──────────────────────────────────────────────────────────

shifts = []
shift_seq = 0

for day in range(1, 31):
    date_str = datetime.date(2026, 4, day).isoformat()

    for period in ("morning", "evening"):
        # Day 15 evening splits into part=1 and part=2 for the price change
        if day == 15 and period == "evening":
            for part in (1, 2):
                shift_seq += 1
                started_at      = "2026-04-15 12:00:00+00" if part == 1 else "2026-04-15 18:00:00+00"
                submitted_at    = "2026-04-15 18:00:00+00" if part == 1 else "2026-04-15 20:00:00+00"
                cashier_sub_at  = "2026-04-15 18:30:00+00" if part == 1 else "2026-04-15 20:30:00+00"
                shifts.append({
                    "seq": shift_seq,
                    "id": f"a1300000-0000-0000-0000-{shift_seq:012d}",
                    "date": date_str, "period": period, "part": part,
                    "shift_type": "price_change",
                    "started_at": started_at, "submitted_at": submitted_at,
                    "cashier_submitted_at": cashier_sub_at,
                    "day": day,
                })
        else:
            shift_seq += 1
            if period == "morning":
                started_at     = f"2026-04-{day:02d} 03:00:00+00"
                submitted_at   = f"2026-04-{day:02d} 11:30:00+00"
                cashier_sub_at = f"2026-04-{day:02d} 12:00:00+00"
            else:
                started_at     = f"2026-04-{day:02d} 12:00:00+00"
                submitted_at   = f"2026-04-{day:02d} 20:00:00+00"
                cashier_sub_at = f"2026-04-{day:02d} 20:30:00+00"
            shifts.append({
                "seq": shift_seq,
                "id": f"a1300000-0000-0000-0000-{shift_seq:012d}",
                "date": date_str, "period": period, "part": 0,
                "shift_type": "standard",
                "started_at": started_at, "submitted_at": submitted_at,
                "cashier_submitted_at": cashier_sub_at,
                "day": day,
            })

# ── pump meter readings ───────────────────────────────────────────────────────

pump_meter = {p: PUMP_BASELINES[p] for p in range(1, 19)}
pump_readings_data = []
pr_seq = [0]

def next_pr():
    pr_seq[0] += 1
    return f"a1400000-0000-0000-0000-{pr_seq[0]:012d}"

for s in shifts:
    day, period, part = s["day"], s["period"], s["part"]
    for p in range(1, 19):
        open_val = pump_meter[p]
        m_delta, e_delta = PUMP_DELTAS[p]
        if part == 0:
            delta = m_delta if period == "morning" else e_delta
        elif part == 1:
            delta = D2(e_delta * Decimal("0.75"))
        else:
            delta = D2(e_delta * Decimal("0.25"))

        close_val = D2(open_val + delta)
        maint_close = (day == 7  and period == "morning" and part == 0 and p == 9) or \
                      (day == 22 and period == "evening" and part == 0 and p == 14)

        pump_readings_data.append({
            "shift_id": s["id"], "pump": p,
            "open_val": open_val, "close_val": close_val,
            "maintenance_close": maint_close,
        })
        pump_meter[p] = close_val

# ── dip readings ──────────────────────────────────────────────────────────────

fuel_delivery_by_shift = {}
for fd in FUEL_DELIVERIES:
    day_num, tank_num, litres = fd[0], fd[1], fd[2]
    for s in shifts:
        if s["day"] == day_num and s["period"] == "morning" and s["part"] == 0:
            sid = s["id"]
            fuel_delivery_by_shift.setdefault(sid, {})[tank_num] = litres
            break

dip_seq = [0]

def next_dip():
    dip_seq[0] += 1
    return f"a1500000-0000-0000-0000-{dip_seq[0]:012d}"

pump_by_shift = defaultdict(list)
for pr in pump_readings_data:
    pump_by_shift[pr["shift_id"]].append(pr)

tank_dip = {t: TANK_BASELINES[t] for t in range(1, 4)}
dip_readings_data = []

for s in shifts:
    sid = s["id"]
    deliveries_this = fuel_delivery_by_shift.get(sid, {})
    for t in range(1, 4):
        open_dip = tank_dip[t]
        tank_pump_delta = sum(
            D2(pr["close_val"] - pr["open_val"])
            for pr in pump_by_shift[sid]
            if PUMP_TANK[pr["pump"]] == t
        )
        delivery_litres = deliveries_this.get(t, Decimal("0.00"))
        expected_close = D2(open_dip + delivery_litres - tank_pump_delta)
        # 0.5% shrinkage on pumped volume keeps variance realistic without compounding
        actual_close = D2(expected_close - D2(Decimal("0.005") * tank_pump_delta))

        assert actual_close >= Decimal("2000.00"), \
            f"Tank {t} below 2000 on {s['date']} {s['period']} part={s['part']}: {actual_close}"
        assert actual_close <= TANK_CAPS[t], \
            f"Tank {t} over capacity on {s['date']} {s['period']}: {actual_close}"

        dip_readings_data.append({
            "shift_id": sid, "tank": t,
            "open_val": open_dip, "close_val": actual_close,
            "delivery_litres": delivery_litres,
            "expected_close": expected_close,
            "meter_delta": tank_pump_delta,
        })
        tank_dip[t] = actual_close

# ── stock readings & deliveries ───────────────────────────────────────────────

stock_count = {k: STOCK_START[k] for k in PRODUCTS}
stock_readings_data = []
stock_deliveries_data = []
sr_seq = [0]
sd_seq = [0]

def next_sr():
    sr_seq[0] += 1
    return f"a2400000-0000-0000-0000-{sr_seq[0]:012d}"

def next_sd():
    sd_seq[0] += 1
    return f"a2500000-0000-0000-0000-{sd_seq[0]:012d}"

for s in shifts:
    sid, day, period, part = s["id"], s["day"], s["period"], s["part"]

    shift_stock_deliveries = {}
    if part == 0:
        if day == 12 and period == "morning":
            shift_stock_deliveries["castrol"] = Decimal("24")
        for prod in PRODUCTS:
            key = (day, period, prod)
            if key in STOCK_DELIVERY_LOOKUP:
                if prod == "castrol" and day == 12 and period == "morning":
                    continue  # already added above
                shift_stock_deliveries[prod] = STOCK_DELIVERY_LOOKUP[key]

    for prod_key, qty in shift_stock_deliveries.items():
        stock_deliveries_data.append({
            "id": next_sd(), "shift_id": sid,
            "product": prod_key, "qty": qty,
        })

    for prod in PRODUCTS:
        open_count = stock_count[prod]
        if part == 0:
            units_sold = Decimal(str(MORNING_UNITS[prod] if period == "morning" else EVENING_UNITS[prod]))
        elif part == 1:
            units_sold = Decimal(str(int(EVENING_UNITS[prod] * 0.75)))
        else:
            units_sold = Decimal(str(EVENING_UNITS[prod] - int(EVENING_UNITS[prod] * 0.75)))

        delivery_units = shift_stock_deliveries.get(prod, Decimal("0"))
        close_count = open_count + delivery_units - units_sold
        assert close_count >= 0, f"Stock {prod} negative on {s['date']} {period} part={part}: {close_count}"

        stock_readings_data.append({
            "id": next_sr(), "shift_id": sid, "product": prod,
            "open_count": open_count, "close_count": close_count,
            "units_sold": units_sold, "delivery_units": delivery_units,
        })
        stock_count[prod] = close_count

# ── indexed lookups ───────────────────────────────────────────────────────────

dip_by_shift = defaultdict(dict)
for dr in dip_readings_data:
    dip_by_shift[dr["shift_id"]][dr["tank"]] = dr

stock_by_shift = defaultdict(dict)
for sr in stock_readings_data:
    stock_by_shift[sr["shift_id"]][sr["product"]] = sr

pos_lines = {}
psl_seq = 0
psl_rows = []
pos_sub_id = {s["id"]: f"a1700000-0000-0000-0000-{i+1:012d}" for i, s in enumerate(shifts)}

for s in shifts:
    sid = s["id"]
    price_95  = get_fuel_price("95",  s["submitted_at"])
    price_d10 = get_fuel_price("D10", s["submitted_at"])
    delta_95  = sum(D2(pr["close_val"] - pr["open_val"]) for pr in pump_by_shift[sid] if PUMP_TANK[pr["pump"]] == 1)
    delta_d10 = sum(D2(pr["close_val"] - pr["open_val"]) for pr in pump_by_shift[sid] if PUMP_TANK[pr["pump"]] in (2, 3))
    pos_95    = D2(delta_95  * Decimal("0.999"))
    pos_d10   = D2(delta_d10 * Decimal("0.999"))
    rev_95    = D2(pos_95  * price_95)
    rev_d10   = D2(pos_d10 * price_d10)
    pos_lines[sid] = {
        "95":  (delta_95,  pos_95,  rev_95,  price_95),
        "D10": (delta_d10, pos_d10, rev_d10, price_d10),
    }
    psid = pos_sub_id[sid]
    psl_seq += 1; lid1 = f"a1800000-0000-0000-0000-{psl_seq:012d}"
    psl_seq += 1; lid2 = f"a1800000-0000-0000-0000-{psl_seq:012d}"
    psl_rows.append(f"('{lid1}', '{psid}', '95',  {pos_95},  {rev_95},  'auto')")
    psl_rows.append(f"('{lid2}', '{psid}', 'D10', {pos_d10}, {rev_d10}, 'auto')")

# ── SQL emission ──────────────────────────────────────────────────────────────

out = []

def section(name):
    out.append(f"\n-- === {name} ===")

def emit(table, cols, rows):
    col_list = ", ".join(cols)
    out.append(f"INSERT INTO {table} ({col_list}) VALUES")
    for i, row in enumerate(rows):
        sep = "," if i < len(rows) - 1 else ";"
        out.append(f"  {row}{sep}")
    out.append("")

out.append("BEGIN;")
out.append(f"-- {'DRY RUN — will ROLLBACK at end' if DRY_RUN else 'Live run — will COMMIT at end'}")
out.append("")
out.append("-- Drop stale unique constraint that blocks split-shift inserts.")
out.append("-- See migration 20260518000001_fix_shifts_part_constraint.sql.")
out.append("ALTER TABLE shifts DROP CONSTRAINT IF EXISTS shifts_station_period_date_unique;")

# FUEL_PRICES
section("FUEL_PRICES")
fp_data = [
    ("a2700000-0000-0000-0000-000000000001", "95",  "22.4800", "21.5000", "2026-03-31 22:00:00+00", "'2026-04-15 18:00:00+00'"),
    ("a2700000-0000-0000-0000-000000000002", "D10", "19.7800", "18.9000", "2026-03-31 22:00:00+00", "'2026-04-15 18:00:00+00'"),
    ("a2700000-0000-0000-0000-000000000003", "95",  "22.9500", "21.9500", "2026-04-15 18:00:00+00", "NULL"),
    ("a2700000-0000-0000-0000-000000000004", "D10", "20.1500", "19.2500", "2026-04-15 18:00:00+00", "NULL"),
]
emit("fuel_prices",
     ["id", "station_id", "fuel_grade_id", "sell_price_per_litre", "cost_per_litre", "valid_from", "valid_to", "set_by"],
     [f"('{fid}', '{STATION_ID}', '{g}', {sell}, {cost}, '{vf}', {vt}, '{OWNER_USER_ID}')"
      for fid, g, sell, cost, vf, vt in fp_data])

# PRODUCTS  (must exist before pos_dry_stock_lines / stock_readings / stock_deliveries FKs)
section("PRODUCTS")
PRODUCT_META = {
    "redbull":  ("RB250",   "Red Bull 250ml"),
    "monster":  ("MON500",  "Monster Energy 500ml"),
    "simba":    ("SIM120",  "Simba Chips 120g"),
    "lays":     ("LAY120",  "Lays Chips 120g"),
    "fanta":    ("FAN500",  "Fanta Orange 500ml"),
    "coke":     ("COK500",  "Coca-Cola 500ml"),
    "castrol":  ("CAS1L",   "Castrol GTX 1L"),
    "lucky":    ("LUC20",   "Lucky Strike 20pk"),
    "cadbury":  ("CAD80",   "Cadbury Dairy Milk 80g"),
    "stimorol": ("STI10",   "Stimorol Gum 10pk"),
}
emit("products",
     ["id", "station_id", "stock_code", "description", "is_active"],
     [f"('{PRODUCT_IDS[k]}', '{STATION_ID}', '{PRODUCT_META[k][0]}', '{PRODUCT_META[k][1]}', true)"
      for k in PRODUCTS])

# SHIFT_BASELINES  (set_by → user_profiles)
section("SHIFT_BASELINES")
sb_rows = []
sb_seq = 0
for p in range(1, 19):
    sb_seq += 1
    bid = f"a2800000-0000-0000-0000-{sb_seq:012d}"
    sb_rows.append(f"('{bid}', '{STATION_ID}', '{pump_uuid(p)}', NULL, 'meter', {PUMP_BASELINES[p]}, '2026-03-31 20:00:00+00', '{OWNER_PROFILE_ID}')")
for t in range(1, 4):
    sb_seq += 1
    bid = f"a2800000-0000-0000-0000-{sb_seq:012d}"
    sb_rows.append(f"('{bid}', '{STATION_ID}', NULL, '{TANK_IDS[t]}', 'dip', {TANK_BASELINES[t]}, '2026-03-31 20:00:00+00', '{OWNER_PROFILE_ID}')")
emit("shift_baselines",
     ["id", "station_id", "pump_id", "tank_id", "reading_type", "value", "set_at", "set_by"],
     sb_rows)

# SHIFTS  (supervisor_id → user_profiles)
section("SHIFTS")
emit("shifts",
     ["id", "station_id", "supervisor_id", "period", "part", "shift_type", "shift_date",
      "started_at", "status", "is_flagged", "flag_comment", "submitted_at", "cashier_submitted_at"],
     [f"('{s['id']}', '{STATION_ID}', '{SUPERVISOR_PROFILE_ID}', '{s['period']}', {s['part']}, "
      f"'{s['shift_type']}', '{s['date']}', '{s['started_at']}', 'closed', false, NULL, "
      f"'{s['submitted_at']}', '{s['cashier_submitted_at']}')"
      for s in shifts])

# PUMP_READINGS
section("PUMP_READINGS")
pr_rows = []
for pr in pump_readings_data:
    rid_o = next_pr()
    rid_c = next_pr()
    pid = pump_uuid(pr["pump"])
    pr_rows.append(f"('{rid_o}', '{pr['shift_id']}', '{pid}', 'open',  NULL, {pr['open_val']},  'auto', false)")
    maint = "true" if pr["maintenance_close"] else "false"
    pr_rows.append(f"('{rid_c}', '{pr['shift_id']}', '{pid}', 'close', NULL, {pr['close_val']}, 'auto', {maint})")
emit("pump_readings",
     ["id", "shift_id", "pump_id", "type", "photo_url", "meter_reading", "ocr_status", "maintenance_required"],
     pr_rows)

# DIP_READINGS
section("DIP_READINGS")
dr_rows = []
for dr in dip_readings_data:
    rid_o = next_dip()
    rid_c = next_dip()
    tid = TANK_IDS[dr["tank"]]
    dr_rows.append(f"('{rid_o}', '{dr['shift_id']}', '{tid}', 'open',  {dr['open_val']})")
    dr_rows.append(f"('{rid_c}', '{dr['shift_id']}', '{tid}', 'close', {dr['close_val']})")
emit("dip_readings", ["id", "shift_id", "tank_id", "type", "litres"], dr_rows)

# DELIVERIES  (recorded_by → user_profiles)
section("DELIVERIES")
del_times = [
    "2026-04-03 07:00:00+00", "2026-04-10 08:30:00+00",
    "2026-04-18 06:00:00+00", "2026-04-25 07:30:00+00",
]
emit("deliveries",
     ["id", "station_id", "tank_id", "litres_received", "delivery_note_number",
      "driver_name", "delivered_at", "recorded_by"],
     [f"('a1600000-0000-0000-0000-{i+1:012d}', '{STATION_ID}', '{TANK_IDS[fd[1]]}', "
      f"{fd[2]}, '{fd[3]}', '{fd[4]}', '{del_times[i]}', '{SUPERVISOR_PROFILE_ID}')"
      for i, fd in enumerate(FUEL_DELIVERIES)])

# POS_SUBMISSIONS
section("POS_SUBMISSIONS")
emit("pos_submissions",
     ["id", "shift_id", "photo_url", "raw_ocr"],
     [f"('{pos_sub_id[s['id']]}', '{s['id']}', NULL, NULL)" for s in shifts])

# POS_SUBMISSION_LINES
section("POS_SUBMISSION_LINES")
emit("pos_submission_lines",
     ["id", "pos_submission_id", "fuel_grade_id", "litres_sold", "revenue_zar", "ocr_status"],
     psl_rows)

# DRY_STOCK_POS_SUBMISSIONS
section("DRY_STOCK_POS_SUBMISSIONS")
dry_sub_id = {s["id"]: f"a2200000-0000-0000-0000-{i+1:012d}" for i, s in enumerate(shifts)}
emit("dry_stock_pos_submissions",
     ["id", "shift_id", "ocr_status"],
     [f"('{dry_sub_id[s['id']]}', '{s['id']}', 'confirmed')" for s in shifts])

# POS_DRY_STOCK_LINES
section("POS_DRY_STOCK_LINES")
pdl_seq = 0
pdl_rows = []
for s in shifts:
    dsid = dry_sub_id[s["id"]]
    for prod in PRODUCTS:
        sr = stock_by_shift[s["id"]][prod]
        rev = D2(sr["units_sold"] * PRODUCT_PRICE[prod])
        pdl_seq += 1
        pdl_rows.append(
            f"('a2300000-0000-0000-0000-{pdl_seq:012d}', '{dsid}', "
            f"'{PRODUCT_IDS[prod]}', {sr['units_sold']:.3f}, {rev}, 'confirmed')"
        )
emit("pos_dry_stock_lines",
     ["id", "dry_stock_pos_submission_id", "product_id", "units_sold", "revenue_zar", "ocr_status"],
     pdl_rows)

# STOCK_DELIVERIES  (recorded_by → auth.users)
section("STOCK_DELIVERIES")
emit("stock_deliveries",
     ["id", "shift_id", "station_id", "product_id", "quantity", "recorded_by"],
     [f"('{sd['id']}', '{sd['shift_id']}', '{STATION_ID}', "
      f"'{PRODUCT_IDS[sd['product']]}', {sd['qty']:.3f}, '{CASHIER_USER_ID}')"
      for sd in stock_deliveries_data])

# STOCK_READINGS  (recorded_by → auth.users)
section("STOCK_READINGS")
emit("stock_readings",
     ["id", "shift_id", "product_id", "closing_count", "recorded_by"],
     [f"('{sr['id']}', '{sr['shift_id']}', '{PRODUCT_IDS[sr['product']]}', "
      f"{sr['close_count']:.3f}, '{CASHIER_USER_ID}')"
      for sr in stock_readings_data])

# RECONCILIATIONS
section("RECONCILIATIONS")
recon_id_map = {s["id"]: f"a1900000-0000-0000-0000-{i+1:012d}" for i, s in enumerate(shifts)}
emit("reconciliations",
     ["id", "shift_id"],
     [f"('{recon_id_map[s['id']]}', '{s['id']}')" for s in shifts])

# RECONCILIATION_TANK_LINES
section("RECONCILIATION_TANK_LINES")
rtl_seq = 0
rtl_rows = []
for s in shifts:
    rid = recon_id_map[s["id"]]
    for t in range(1, 4):
        dr = dip_by_shift[s["id"]][t]
        variance = D2(dr["close_val"] - dr["expected_close"])
        rtl_seq += 1
        rtl_rows.append(
            f"('a2000000-0000-0000-0000-{rtl_seq:012d}', '{rid}', '{TANK_IDS[t]}', "
            f"{dr['open_val']}, {dr['delivery_litres']}, {dr['meter_delta']}, "
            f"{dr['expected_close']}, {dr['close_val']}, {variance})"
        )
emit("reconciliation_tank_lines",
     ["id", "reconciliation_id", "tank_id", "opening_dip", "deliveries_received",
      "meter_delta", "expected_closing_dip", "actual_closing_dip", "variance_litres"],
     rtl_rows)

# RECONCILIATION_GRADE_LINES
section("RECONCILIATION_GRADE_LINES")
rgl_seq = 0
rgl_rows = []
for s in shifts:
    rid = recon_id_map[s["id"]]
    for grade in ("95", "D10"):
        meter_delta, pos_litres, pos_rev, price = pos_lines[s["id"]][grade]
        var_l   = D2(meter_delta - pos_litres)
        exp_rev = D2(meter_delta * price)
        var_zar = D2(exp_rev - pos_rev)
        rgl_seq += 1
        rgl_rows.append(
            f"('a2100000-0000-0000-0000-{rgl_seq:012d}', '{rid}', '{grade}', "
            f"{meter_delta}, {pos_litres}, {var_l}, {price}, {exp_rev}, {pos_rev}, {var_zar})"
        )
emit("reconciliation_grade_lines",
     ["id", "reconciliation_id", "fuel_grade_id", "meter_delta", "pos_litres_sold",
      "variance_litres", "sell_price_per_litre", "expected_revenue_zar", "pos_revenue_zar", "variance_zar"],
     rgl_rows)

# RECONCILIATION_STOCK_LINES
section("RECONCILIATION_STOCK_LINES")
rsl_seq = 0
rsl_rows = []
for s in shifts:
    rid = recon_id_map[s["id"]]
    for prod in PRODUCTS:
        sr = stock_by_shift[s["id"]][prod]
        exp   = D3(sr["open_count"] + sr["delivery_units"] - sr["units_sold"])
        var_u = D3(sr["close_count"] - exp)
        var_z = D2(var_u * PRODUCT_PRICE[prod])
        rsl_seq += 1
        rsl_rows.append(
            f"('a2600000-0000-0000-0000-{rsl_seq:012d}', '{rid}', '{PRODUCT_IDS[prod]}', "
            f"{sr['open_count']:.3f}, {sr['delivery_units']:.3f}, {sr['units_sold']:.3f}, "
            f"{exp:.3f}, {sr['close_count']:.3f}, {var_u:.3f}, {var_z})"
        )
emit("reconciliation_stock_lines",
     ["id", "reconciliation_id", "product_id", "opening_count", "deliveries_received",
      "pos_units_sold", "expected_closing_count", "actual_closing_count", "variance_units", "variance_zar"],
     rsl_rows)

if DRY_RUN:
    out.append("ROLLBACK; -- dry run: no changes committed")
else:
    out.append("COMMIT;")
out.append("")

# ── write ─────────────────────────────────────────────────────────────────────

with open(OUT, "w", encoding="utf-8") as f:
    f.write("\n".join(out) + "\n")

print(f"Written to {OUT} ({'DRY RUN' if DRY_RUN else 'live'})")
print(f"  Shifts:         {len(shifts)}")
print(f"  Pump readings:  {len(pump_readings_data) * 2}")
print(f"  Dip readings:   {len(dip_readings_data) * 2}")
print(f"  Stock readings: {len(stock_readings_data)}")
print(f"  Stock deliveries: {len(stock_deliveries_data)}")
