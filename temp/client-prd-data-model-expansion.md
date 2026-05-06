# FuelTracker v3 — Feature Proposal
## Data Model Expansion: Cashier Workflow, Dry Stock, Pricing & Reporting

**Prepared for:** Client  
**Date:** 5 May 2026  
**Version:** 1.0

---

## Overview

This document outlines a set of enhancements to the FuelTracker system to bring it in line with how your stations actually operate day-to-day. The changes fall into five areas:

1. A dedicated cashier role and workflow
2. Dry stock (oil products) tracking and reconciliation
3. Per-station fuel pricing with date ranges and cost tracking
4. Flexible shift splitting when a price change occurs mid-day
5. Improved delivery records and owner reporting

Each section describes what will change, who it affects, and what the system will do.

---

## 1. Cashier Role & Workflow

### What changes

A new **cashier** user type will be added to the system. Currently, the supervisor handles everything at shift end — including the POS Z-report. Going forward, the cashier will be responsible for the POS and dry stock tasks, while the supervisor continues to handle pump meter readings and tank dips.

### How it works

- The owner creates cashier accounts in the user management screen, assigning each cashier to their station.
- At shift end, two separate workflows run in parallel:
  - **Supervisor track:** pump meter readings, tank dip readings
  - **Cashier track:** POS Z-report scan, dry stock count, dry stock deliveries
- The shift progress checklist shows both tracks. The supervisor cannot submit the shift until both tracks are marked complete.
- The cashier logs in and sees only their current station's open shift — they have no access to pump readings, dip readings, configuration, or reports.

### Who is affected

| Role | Change |
|---|---|
| Owner | Can now create and manage cashier accounts |
| Supervisor | Still submits the shift, but no longer handles POS |
| Cashier | New login and workflow — POS scanning + dry stock |

---

## 2. Dry Stock Tracking & Reconciliation

### What changes

The system will track oil and lubricant product inventory per shift — replacing the current manual spreadsheet process. At shift end, the cashier counts closing stock per product and scans the dry stock section of the POS Z-report. The system then reconciles the two figures automatically.

### Product Catalogues

- The owner creates one or more **product catalogues** (e.g. "Total" for Speedway, "Elegant" for Amaglug and Truck Stop).
- Each station is assigned to a catalogue. Two stations pointing at the same catalogue automatically share their product list.
- Products have: stock code, description, cost price, and selling price.
- Products can be deactivated without losing historical data.

### Opening Stock

- The owner sets an initial opening stock count per product per station once, before the first shift.
- After that, the system automatically carries each shift's closing count forward as the next shift's opening count — no manual entry required.

### Cashier Capture (at shift end)

1. Cashier photographs the dry stock section of the POS Z-report — the system extracts product sales lines via OCR.
2. Cashier confirms or corrects the OCR-extracted figures.
3. Cashier enters a closing stock count per product.
4. Cashier records any dry stock deliveries received during the shift (product and units received).

### Reconciliation Formula

For each product:

> **Expected closing stock = Opening stock + Deliveries received − POS units sold**
>
> **Variance = Actual closing count − Expected closing stock**
>
> **Variance in ZAR = Variance (units) × Selling price**

- A positive variance means more stock on the shelf than expected.
- A negative variance means stock is missing — possible loss or theft.

The variance is shown on the shift summary page and included in the owner's monthly dry stock report. If an override is submitted after the shift is closed, the reconciliation re-runs automatically.

---

## 3. Per-Station Fuel Pricing with Cost Tracking

### What changes

Currently the system holds one fuel price per grade, shared across all stations. This will be replaced with a per-station price system that supports:

- Different prices per grade per station
- A date range (valid from / valid to) for each price
- Both **cost price** (what the station pays per litre) and **selling price** (what customers pay)

### How pricing works

- The owner sets prices per grade per station with a start and end date.
- When a new price takes effect, the owner enters it with a new valid-from date — the system automatically closes the previous price.
- The system uses the price that was active **at the time the shift started** for all reconciliation calculations on that shift. A price change mid-month does not retroactively affect closed shifts.

### Gross Margin (GP)

Because the system now stores both cost and selling price, it can compute **gross profit per grade per day**:

> **GP = (Selling price − Cost price) × Litres sold**

This figure will appear in daily and monthly owner reports.

> **Note:** All existing fuel prices will need to be re-entered with station assignment and date ranges after the system update is applied. This is a one-time task.

---

## 4. Shift Splitting for Price Changes

### What changes

Currently the system allows only two shifts per day — morning and evening. This will be expanded to allow a shift to be split mid-period when a fuel price change takes effect.

### How it works

When a price change occurs during a morning or evening shift:

1. The supervisor closes the current shift early — this becomes **"Morning Part 1"** (or Evening Part 1).
2. The supervisor opens a new shift immediately — this becomes **"Morning Part 2"** (or Evening Part 2), and is marked as a **price change** shift type.
3. Each part is reconciled independently using the price that was active when that shift started.

This ensures that no litres are ever reconciled at the wrong price, and the financial impact of the price change is cleanly separated.

The shift history and all reports will display the split clearly — "Morning Part 1 / Morning Part 2" — so the owner can see why extra shifts exist on a given day.

---

## 5. Delivery Records

### What changes

Two fields will be added to fuel delivery records:

- **Delivery note number** (required) — the reference number from the supplier's delivery documentation. The system will reject a duplicate note number for the same station, preventing accidental double-capture.
- **Driver name** (optional) — the name of the delivery driver.

### Owner Delivery Search

A new screen will be available to the owner to **search and filter all fuel deliveries** by:
- Station
- Date range
- Delivery note number

---

## 6. Owner Reporting

The owner reporting page will be updated to match the format of the current manual spreadsheet reports.

### Daily Fuel Report (per station, per month)

A full daily breakdown showing, per grade:

| Column | Description |
|---|---|
| Date | Day of the month |
| Opening Dip | Tank level at start of day (litres) |
| Delivery Note / Driver | Reference and driver for any delivery |
| Delivery (litres) | Litres received |
| POS Sales (litres) | Sales as reported by the till |
| Sales per Dips (litres) | Sales implied by tank level change |
| Variance | Difference between the two |
| Accumulated Variance | Running total of variance for the month |
| GP (ZAR) | Gross profit for the day |

Monthly totals and average daily sales per grade are shown at the bottom.

### Monthly Sales Summary (cross-station)

A consolidated monthly view showing, per station per grade:

- Total litres sold
- Total GP (ZAR)
- Station subtotals and grand total
- **GAIN/LOSS** — the financial impact of any mid-month fuel price changes on tank inventory at the time of the change
- **GP After Gain/Loss** — the adjusted profitability figure

### Inventory Snapshot (Dashboard)

A live dashboard widget showing the current fuel inventory position across all stations:

- Per station, per grade: litres in tank + cost price per litre + total value (ZAR)
- Based on the most recent closed shift's tank dip reading
- Valued at **cost price** (what the station paid for the fuel in the ground)

---

## Summary of Changes

| Area | What's new |
|---|---|
| Users | Cashier role with station-scoped workflow |
| Shifts | Cashier track on checklist; shift splitting for price changes; Part 1 / Part 2 labels |
| Dry Stock | Product catalogues, stock count per shift, delivery tracking, reconciliation |
| Fuel Prices | Per-station pricing with date ranges; cost price; GP calculation |
| Deliveries | Delivery note number (required, unique); driver name; owner search screen |
| Reporting | Daily fuel report with GP; monthly summary with gain/loss; inventory snapshot |

---

## Out of Scope

The following items are not included in this proposal:

- Parking income tracking
- Automated supplier invoice reconciliation for dry stock
- E-commerce or customer-facing features
- Automated alerts when prices change

---

## Next Steps

Upon approval of this proposal, development will proceed with database migrations, followed by backend logic, then UI screens. A backfill of the new fuel price structure will be required once the update is deployed — the owner will need to re-enter all station prices with date ranges at that time.
