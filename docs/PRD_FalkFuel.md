# FalkFuel — Fuel Station Management System
## Product Requirements Document

**Version:** 1.0
**Date:** March 2026
**Prepared for:** FalkFuel

---

## 1. Overview

FalkFuel is a mobile-responsive web application that digitises and automates the shift workflow across all fuel stations in your chain. Attendants capture pump meter readings and tank dip levels at the start and end of every shift. Sales data is pulled directly from the POS Z-report via photo and automated text recognition. The system automatically reconciles inventory and revenue figures on every shift submission and surfaces variances to supervisors and owners in real time.

The goal is to eliminate manual paper-based reconciliation, close gaps in the photo audit trail, and give station owners a single dashboard across all sites.

---

## 2. Business Context

### Problem

- Attendants record pump meter readings and tank dip levels on paper, creating a fragmented and error-prone audit trail.
- Supervisors reconcile paper records against POS Z-reports manually — a slow, unreliable process.
- Pump photos are not taken systematically, leaving no photographic evidence for disputed readings.
- Fuel deliveries are tracked informally, making stock reconciliation unreliable.
- Station owners have no centralised view across sites and must chase paper records for daily performance data.

### Solution

A structured digital shift workflow with:
- Photo capture and automated OCR extraction of pump meter readings and POS Z-reports.
- Automatic inventory and revenue reconciliation on every shift close.
- A complete photo and data audit trail per shift.
- Supervisor review and approval workflow with override capability.
- Owner dashboard and reports across all stations.
- Offline operation for low-signal environments, with automatic sync on reconnect.

---

## 3. Stations in Scope

| Station | Tanks | Total Capacity | Pumps |
|---|---|---|---|
| Elegant Amaglug | 3 | 92,000 L | 18 |
| Speedway | 6 | 138,000 L | 36 |
| Truck Stop | 4 | 73,000 L | 7 |

**Fuel grades in use:** 95 (unleaded), 93 (unleaded), D10 (diesel), D50 (diesel).

---

## 4. Roles and Access

| Role | Who | What they can do |
|---|---|---|
| Attendant | Station staff | Open and close shifts at their assigned station |
| Supervisor | Senior station staff | Review, approve, and flag submitted shifts; record deliveries; override readings |
| Owner / Admin | Chain owner | Cross-station dashboard, reports, configuration, user management, pricing |

Access is scoped by station — attendants and supervisors can only see data for their own station. Owners have access across all stations.

---

## 5. Shift Model

- Two shifts per day: **morning** and **evening**.
- One attendant covers the entire station (all pumps and all tanks) per shift.
- Any attendant can work any pump — no fixed pump assignment.

---

## 6. Feature Requirements

### 6.1 Attendant — Shift Open

1. Attendant logs in with email and password.
2. Attendant selects their station and shift period (morning or evening).
3. The app displays all pumps at that station in a sequential list.
4. For each pump, the attendant photographs the meter display.
5. The app automatically extracts the meter reading from the photo using OCR and presents it for confirmation.
6. The attendant confirms the reading or corrects it if the extraction was wrong.
7. If the photo is unreadable, the attendant marks it as such and types the reading manually.
8. After all pump photos are captured, the attendant enters the opening dip reading (in litres) for each tank.
9. A progress indicator shows how many pumps and tanks have been completed.
10. The attendant can save progress as a draft and return to it after an interruption.

### 6.2 Attendant — Shift Close

1. Attendant photographs each pump's meter at shift end using the same sequential flow.
2. The app OCR-extracts each closing reading for confirmation.
3. Attendant enters the closing dip reading (in litres) for each tank.
4. Attendant photographs the POS Z-report printout.
5. The app extracts the Z-report data (fuel grade, litres sold, revenue per line) and displays it for review.
6. Attendant confirms or corrects each line individually.
7. If the Z-report photo is unreadable, attendant enters all sales figures manually.
8. Attendant submits the completed shift.
9. App confirms successful submission.

### 6.3 Offline Operation

1. The app works without an internet connection — attendants can capture photos and enter all readings offline.
2. A visible indicator shows how many actions are waiting to sync.
3. When the device reconnects, all pending data syncs automatically.
4. Attendant is notified whether the sync succeeded or if anything requires attention.

### 6.4 Supervisor — Shift Review

1. Supervisor sees a list of all submitted shifts at their station awaiting review.
2. Supervisor opens a shift to view: all pump photos, confirmed meter readings, dip readings, POS photo, extracted sales lines, and automatic reconciliation results — in one screen.
3. Supervisor can **approve** the shift (locks the record) or **flag it for follow-up** with a comment.
4. Supervisor can override an OCR-extracted value after submission (e.g. if an attendant missed a misread). Every override is recorded with the supervisor's name, the original value, the new value, and a reason. Reconciliation recalculates automatically.
5. Supervisor has a separate view of all currently flagged shifts.

### 6.5 Supervisor — Deliveries

1. Supervisor records a fuel delivery by selecting the receiving tank, entering litres received, and photographing the delivery note.
2. Delivery is timestamped automatically and associated with the correct shift period.
3. Supervisor can view the full delivery history at their station.
4. Deliveries are factored into the reconciliation calculation automatically.

### 6.6 Automatic Reconciliation

Reconciliation runs automatically every time a shift is submitted or an override is applied. No manual triggers required. Three formulas are calculated:

**Formula 1 — Tank Inventory Variance (per tank)**

> Expected Closing Dip = Opening Dip + Deliveries Received − POS Litres Sold
> Tank Variance = Expected Closing Dip − Actual Closing Dip

A positive variance indicates unaccounted stock loss. A negative variance indicates an unexplained gain.

**Formula 2 — Pump Meter vs POS Variance (per fuel grade)**

> Meter Delta = Sum of (Closing Meter − Opening Meter) across all pumps of the same grade
> Variance = Meter Delta − POS Litres Sold for that grade

**Formula 3 — Revenue Variance (per fuel grade)**

> Expected Revenue = POS Litres Sold × Selling Price per Litre
> Revenue Variance = Expected Revenue − POS Reported Revenue (in ZAR)

All reconciliation results are stored and linked to the shift record permanently.

### 6.7 Owner / Admin — Dashboard and Reports

1. **Cross-station dashboard**: shows the status of today's shifts at every station (pending open, open, submitted, approved).
2. **Daily variance report per station**: opening dip, deliveries, POS sales, expected closing dip, actual closing dip, and tank variance for each tank.
3. **Daily pump-meter-vs-POS report per station**: meter delta vs POS litres per fuel grade.
4. **Daily financial summary per station**: expected revenue vs POS reported revenue, and ZAR variance per grade.
5. **Weekly and monthly aggregates** of all daily reports.
6. **Shift history**: full browsable history per station, filterable by date, shift period, attendant, and status.
7. **Shift detail view**: every photo, reading, OCR extraction, supervisor override, and reconciliation result for any historical shift.
8. **Tank level trend chart**: tank level over a selectable date range per tank per station (for spotting slow leaks or unusual patterns).
9. **CSV export** of all reports.

### 6.8 Owner / Admin — Configuration

1. Create and edit stations (name, address).
2. Configure tanks per station (label, fuel grade, capacity in litres).
3. Configure pumps per station and map each pump to a tank.
4. Update pump-to-tank mappings when physical plumbing changes.
5. Set the selling price per fuel grade in ZAR per litre.
6. Price changes are versioned and timestamped — historical reconciliations always use the price that was active at the time of the shift.

### 6.9 Owner / Admin — User Management

1. Invite users by email and assign them a role (attendant or supervisor) and station.
2. Change a user's role or station assignment.
3. Deactivate a user account without deleting it (preserves audit trail when staff leave).
4. View all users across all stations with their roles and last login date.

---

## 7. Audit Trail and Data Integrity

- Every pump reading stores: the original photo, the OCR-extracted value, the attendant-confirmed value, and whether the value was auto-extracted, manually overridden, or entered because the photo was unreadable.
- Every supervisor override stores: the field changed, original value, new value, supervisor name, and reason.
- Once a shift is approved, the underlying readings are locked. Any subsequent corrections go through the override record — the original values are never deleted.
- All financial reconciliation uses the selling price that was active at the time of shift submission, not the current price.

---

## 8. Non-Functional Requirements

| Requirement | Detail |
|---|---|
| Platform | Mobile-responsive web app (PWA). Works on any modern smartphone browser. No app store install required. |
| Offline support | Full shift capture (photos + readings) works without an internet connection. Auto-syncs on reconnect. |
| Photo volume | Up to 73 photos per shift at Speedway (36 open + 36 close + 1 Z-report). Photos are compressed before upload. |
| Authentication | Email and password login. Session-based access control. |
| Data security | All data is scoped by station. Attendants and supervisors cannot access data from other stations. |
| Currency | All financial figures in ZAR (South African Rand). |
| Price versioning | Fuel prices change regularly (government-controlled in South Africa). All price changes are versioned. |

---

## 9. Out of Scope

The following are explicitly excluded from this system:

- Native iOS or Android app (web app only).
- SMS or email notifications.
- Supplier portal or delivery driver access.
- Direct integration with POS systems (sales data is captured via Z-report photo).
- Cost price tracking, procurement, or margin analysis.
- Automated alerts when variances exceed a threshold.
- Conversion from dip stick millimetres to litres (attendants read litres directly from the dip chart).
- Per-attendant pump assignment (any attendant can cover any pump).
- Multi-company deployment (single-company system).

---

## 10. Glossary

| Term | Definition |
|---|---|
| Dip reading | A measurement of fuel volume in a tank, taken by inserting a calibrated rod (dipstick) into the tank. Recorded in litres. |
| Pump meter reading | The cumulative litre counter displayed on a fuel pump. The difference between opening and closing readings equals litres dispensed during the shift. |
| Z-report | An end-of-day or end-of-shift printout from the POS system summarising sales by fuel grade (litres sold and revenue). |
| OCR | Optical Character Recognition — automated extraction of text from a photograph. |
| Reconciliation | The process of comparing expected fuel inventory and revenue figures against actual recorded values to identify variances. |
| Tank variance | The difference between what a tank should contain (based on opening stock, deliveries, and sales) and what it actually contains (based on the closing dip reading). |
| Shift | A defined work period (morning or evening) at a single station, covering all pumps and tanks. |
