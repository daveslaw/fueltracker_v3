# FuelTracker v3 — User Testing Guide

**Version:** May 2026  
**App URL:** https://fueltracker-v3.vercel.app/ 
**Feedback:** Add comments directly in this document, or email dave@yswsolutions.co.za

---

## Overview

This guide walks a tester through the complete FuelTracker workflow in a single end-to-end session. You will play four roles in sequence:

1. **Supervisor (Part 1)** — opens a shift and enters all close readings
2. **Cashier (Part 2)** — submits POS data and stock counts against that same shift
3. **Supervisor (Part 3)** — returns to submit the shift and review results
4. **Owner (Part 4)** — reviews reports, shift history, and configuration

> **Important:** The supervisor cannot submit a shift until the cashier has submitted their side. Parts 1 and 3 are split for this reason — enter readings first, let the cashier complete Part 2, then return to submit in Part 3.

The goal is to surface anything that feels confusing, broken, missing, or could be improved. There are no wrong answers — if something made you hesitate, note it.

**Time estimate:** 60–90 minutes for a thorough pass.

---

## Credentials

| Role | Email | Password |
|---|---|---|
| Supervisor | _(insert)_ | _(insert)_ |
| Cashier | _(insert)_ | _(insert)_ |
| Owner | _(insert)_ | _(insert)_ |

---

## How to Give Feedback

For each step below there is a **Feedback** line. Write your observations there. Use any format — bullet points, a sentence, "N/A" if nothing to note.

Focus on:
- Anything confusing or unclear
- Any errors, crashes, or unexpected behaviour
- Any step that felt like extra work
- Any missing information you expected to see
- Anything you'd like to change

---

---

# Part 1 — Supervisor: Enter Readings

**Log in as the Supervisor.**

---

### Step 1.1 — Login

1. Open the app URL.
2. Enter the supervisor email and password.
3. Click **Sign In**.

> **What to check:** Does the login succeed? Are you taken to the right page?

**Feedback:**

---

### Step 1.2 — Shift Home Page

After login you should land on the shift home page (`/shift`).

1. Note what you see: any existing shifts listed?
2. Check the status badges on any shifts (Pending, Closed, Flagged).

> **What to check:** Is the page clear about what action you should take next? Do the shift labels (morning/evening, date) make sense?

**Feedback:**

---

### Step 1.3 — Create a New Shift

1. Click **New shift** (or the equivalent button to create a shift).
2. Confirm the shift is created and you are taken into the shift workflow.

> **What to check:** Was the creation instant? Did anything go wrong? Were you clear on what "period" means (morning vs evening)?

**Feedback:**

---

### Step 1.4 — Enter Pump Meter Readings

You are now at the **Close Pumps** step (`/shift/[id]/close/pumps`).

1. Note the pump cards — how many pumps are listed?
2. Enter a closing meter reading for each pump. Use realistic numbers (e.g. if opening was 12,450 L, try 12,530 L).
3. Note the **Maintenance required** checkbox on the pump form — try ticking it for one pump to flag that it needs attention.
4. Watch the progress counter update (X/Y pumps done).
5. When all readings are entered, proceed to the next step.

> **What to check:**
> - Is it clear which pump is which?
> - Is the unit (litres) obvious?
> - What happens if you enter a number lower than the opening reading?
> - Does the progress counter work correctly?
> - Is the maintenance flag obvious and labelled clearly?
> - Is navigation between pumps smooth?

**Feedback:**

---

### Step 1.5 — Enter Tank Dip Readings

You are now at the **Close Dips** step (`/shift/[id]/close/dips`).

1. Note the tanks listed — label, grade, and capacity.
2. Enter a dip level for each tank. Use a realistic number below the tank capacity.
3. Watch the progress counter.
4. Proceed to the next step when all tanks are filled in.

> **What to check:**
> - Is it clear what a "dip" is? (physical measurement of fuel level in the tank)
> - Are the tank labels meaningful?
> - Is the unit (litres) clear?
> - What happens if you enter a number above the tank capacity?

**Feedback:**

---

### Step 1.6 — Record a Delivery

You are now at the **Deliveries** step (`/shift/[id]/close/deliveries`).

1. Click to add a new delivery.
2. Select a tank.
3. Enter a delivery volume (e.g. 5,000 litres).
4. Leave the receipt photo blank for now.
5. Save the delivery.
6. Confirm it appears in the deliveries list.
7. Try deleting it and re-adding it.
8. Proceed to the next step.

> **What to check:**
> - Is the form clear?
> - Can you select the correct tank?
> - Does the delivery appear in the list correctly?
> - Is delete working?

**Feedback:**

---

### Step 1.7 — Visit Summary (Pre-Cashier)

You are now at the **Summary** step (`/shift/[id]/close/summary`).

1. Review the checklist — Pumps and Dips should show as complete.
2. Note the **Cashier** row — it should show as **Pending** (the cashier has not submitted yet).
3. Confirm the **Submit** button is disabled or blocked.
4. Note the deliveries count in the Deliveries row.
5. **Do not submit yet.** Log out and move to Part 2.

> **What to check:**
> - Is the checklist clear?
> - Is it obvious why the submit button is not available (cashier pending)?
> - Is the Cashier row clearly labelled and easy to understand?

**Feedback:**

---

**Log out of the supervisor account before proceeding to Part 2.**

---

---

# Part 2 — Cashier Workflow

**Log in as the Cashier.**

---

### Step 2.1 — Cashier Home Page

After login you should land on `/cashier`.

1. Find the shift the supervisor just opened — it should appear in the list with a **Pending** status (not yet closed).
2. Note the status indicator on the shift.
3. Click the shift to open the cashier hub.

> **What to check:**
> - Is the shift easy to identify (correct date, period, station)?
> - Is the status indicator ("Not started", "In progress") clear?

**Feedback:**

---

### Step 2.2 — Cashier Hub (Progress Overview)

You are now on the cashier hub for this shift.

1. Note the three sections: **Fuel POS**, **Dry Stock POS**, **Stock Count**.
2. Confirm the submit button is disabled (not all sections complete yet).
3. Note the circular progress indicators.

> **What to check:**
> - Is the hub layout clear?
> - Is it obvious which sections still need input?
> - Is the order (Fuel POS → Dry Stock POS → Stock Count) logical?

**Feedback:**

---

### Step 2.3 — Enter Fuel POS Z-Report

1. Click **Fuel POS**.
2. For each fuel grade listed, enter litres sold and revenue (ZAR).
   - Example: 95 — 500 L, R12,500 | Diesel — 1,200 L, R27,600
3. Leave the photo upload blank for now.
4. Save and return to the hub.
5. Confirm the Fuel POS section shows as complete (green tick).

> **What to check:**
> - Are the grade names clear?
> - Is it obvious that revenue should be in ZAR?
> - What happens if you enter 0 litres for all grades?
> - Is the save confirmation clear?

**Feedback:**

---

### Step 2.4 — Enter Dry Stock POS Z-Report

1. Click **Dry Stock POS**.
2. For each product listed, enter units sold and revenue (ZAR).
3. Leave photo blank.
4. Save and return to the hub.
5. Confirm section shows as complete.

> **What to check:**
> - Are the product names recognisable?
> - Is the form usable if there are many products?
> - Any missing products you'd expect to see?

**Feedback:**

---

### Step 2.5 — Enter Stock Count

1. Click **Stock Count**.
2. For each product, note the opening count and deliveries shown (read-only).
3. Enter a physical closing count for each product.
4. Save and return to the hub.

> **What to check:**
> - Is the opening count / deliveries display helpful context?
> - Is it clear you are entering the physical count you just did?
> - Does the form handle many products well?

**Feedback:**

---

### Step 2.6 — Submit Cashier Shift

1. Back on the cashier hub, confirm all three sections are ticked.
2. Click **Submit**.
3. Confirm submission is locked (sections become read-only).
4. Note the submission timestamp.

> **What to check:**
> - Is the submit button obvious once all sections are complete?
> - Is there a confirmation step before final submission?
> - Is the locked/submitted state clear?

**Feedback:**

---

### Step 2.7 — View Cashier Summary

After submission, navigate to the cashier summary page.

1. Review the **Fuel Sales** section.
2. Review the **Dry Stock** section — check the variance column (expected vs actual closing, colour coded).
3. Note any red or amber variances.

> **What to check:**
> - Is the summary readable?
> - Do the variance colours make sense?
> - Is there anything you'd want to see here that's missing?

**Feedback:**

---

**Log out of the cashier account before proceeding to Part 3.**

---

---

# Part 3 — Supervisor: Submit and Review

**Log in as the Supervisor.**

---

### Step 3.1 — Return to Shift Summary

Navigate back to the shift you opened in Part 1 (`/shift/[id]/close/summary`).

1. Note the **Cashier** row now shows as **Submitted**.
2. Confirm the full checklist (Pumps, Dips, Cashier) is complete.
3. Note the **Submit** button is now available.

> **What to check:**
> - Is it clear that the cashier has submitted?
> - Is the transition from "Pending" to "Submitted" on the cashier row obvious?

**Feedback:**

---

### Step 3.2 — Submit the Shift

1. Click **Submit shift**.
2. Confirm the shift status changes to Closed.
3. The summary should now show the reconciliation tables.

> **What to check:**
> - Is the submit button easy to find?
> - Is there any loading state while the shift closes?
> - After submitting, do the reconciliation tables appear clearly?

**Feedback:**

---

### Step 3.3 — Review Reconciliation Results

The shift is now closed. Review the tables on the summary page.

1. Find the **Tank Inventory** section — check opening dip, delivery, expected vs actual closing dip, and variance.
2. Find the **Pump Meter vs POS Revenue** section — note the grade rows and variance columns.
3. Scroll to the **Deliveries** section.
4. Note the colour coding (red/amber/green) on variance values.

> **What to check:**
> - Is it obvious what the variance means (positive vs negative)?
> - Is the layout easy to scan?
> - Would you know what action to take if you saw a large red variance?
> - Anything confusing about the column headings?

**Feedback:**

---

### Step 3.4 — Flag the Shift

1. Scroll to the **Flag Shift** section.
2. Enter a comment (e.g. "Pump 3 meter stuck — reading estimated").
3. Click **Flag**.
4. Confirm the shift now shows a flagged status.
5. Try unflagging it (remove the flag).

> **What to check:**
> - Is the flagging process clear?
> - Is the flag status visible and obvious on the summary?
> - Is unflagging easy to find?

**Feedback:**

---

### Step 3.5 — Override a Reading (Correction)

1. Find the **Corrections** section on the summary page.
2. Expand one pump reading correction form.
3. Enter a corrected value and a reason.
4. Submit the correction.
5. Confirm the override appears in the audit trail.

> **What to check:**
> - Is the correction form easy to find?
> - Are the fields clear (corrected value, reason)?
> - Does the audit trail make sense (original → override)?
> - Is it clear who made the correction and when?

**Feedback:**

---

**Log out of the supervisor account before proceeding to Part 4.**

---

---

# Part 4 — Owner / Admin Workflow

**Log in as the Owner.**

---

### Step 4.1 — Dashboard Home

After login you should land on `/dashboard`.

1. Review the station cards — one per station.
2. Note the pending shifts count, flagged shift indicators, and inventory tables.
3. Try creating a shift slot: pick a station, period, and date, then click create.

> **What to check:**
> - Is the dashboard easy to scan at a glance?
> - Is the inventory table (grade, litres, value) clear?
> - Is the flagged shift indicator obvious?
> - Is the shift slot creation form self-explanatory?

**Feedback:**

---

### Step 4.2 — Daily Fuel Control Report

1. Navigate to **Reports**.
2. Select a station and a month.
3. Review the daily grid — look for variance indicators (coloured dots).
4. Click into a specific day if drill-down is available.

> **What to check:**
> - Is the colour legend (red = loss, amber = overage, green = balanced) understandable?
> - Is it easy to spot problem days?
> - Is the date/period layout clear?

**Feedback:**

---

### Step 4.3 — Weekly Report

1. Navigate to **Reports → Weekly**.
2. Select a station and a week.
3. Review the table.
4. Try exporting to CSV.

> **What to check:**
> - Are the columns clear (tank variance, meter variance, revenue variance)?
> - Is the CSV export working and named sensibly?
> - Is the week picker intuitive?

**Feedback:**

---

### Step 4.4 — Monthly Report

1. Navigate to **Reports → Monthly**.
2. Select a station and a month.
3. Check the totals row at the bottom.

> **What to check:**
> - Does the monthly view add useful context over weekly?
> - Are totals calculated and displayed clearly?

**Feedback:**

---

### Step 4.5 — Dry Stock Report

1. Navigate to **Reports → Dry Stock**.
2. Select a station and date range.
3. Review the per-product variance table.

> **What to check:**
> - Are product names clear?
> - Is the variance (expected vs actual, units + ZAR) understandable?
> - Is filtering by date range easy?

**Feedback:**

---

### Step 4.6 — Deliveries Report

1. Navigate to **Reports → Deliveries**.
2. Check the summary cards (total deliveries, total litres).
3. Review the paginated table.
4. Try filtering by date range and station.
5. Try exporting to CSV.

> **What to check:**
> - Is pagination working?
> - Are filters clear?
> - Is the receipt photo link accessible?

**Feedback:**

---

### Step 4.7 — Tank Level Trends

1. Navigate to **Tank Trends**.
2. Select a station.
3. Try the preset buttons: 7 days, 30 days.
4. Try a custom date range.
5. Look for delivery markers on the chart.

> **What to check:**
> - Is the chart readable?
> - Are the delivery markers (D) obvious and useful?
> - Is it easy to identify which line corresponds to which tank?
> - Does the date range picker work intuitively?

**Feedback:**

---

### Step 4.8 — Shift History

1. Navigate to **History**.
2. Try filtering by: date range, station, period, status (flagged), supervisor.
3. Click into the shift you submitted earlier.

> **What to check:**
> - Are the filter controls clear?
> - Is the table scannable?
> - Do the status badges make sense?

**Feedback:**

---

### Step 4.9 — Shift History Detail

You are now on the detail page for the shift from Parts 1–3.

1. Review each section: Pump Readings, Dips, POS Z-report, Reconciliation tables.
2. Find the override you made in Step 3.5 — is it shown with the audit trail?
3. Find the flag that was set and removed in Step 3.4.
4. Review the Financial reconciliation table (expected vs POS revenue per grade).
5. Check whether the pump flagged as "Maintenance required" in Step 1.4 is visible.

> **What to check:**
> - Is the full audit trail clear and trustworthy?
> - Are photo modals (if any) working?
> - Is the override history easy to follow?
> - Is the financial table understandable without explanation?
> - Is the maintenance flag surfaced clearly?

**Feedback:**

---

### Step 4.10 — Station Configuration

1. Navigate to **Config**.
2. Browse the station tree — tanks and pumps.
3. Click into a station to view its details.
4. Find where you would edit a tank (label, grade, capacity).
5. Find where you would add a pump.

> **What to check:**
> - Is the config structure navigable?
> - Are the labels (label, grade, capacity) clear?
> - Is it obvious how to get to tank vs pump editing?

**Feedback:**

---

### Step 4.11 — Fuel Pricing

1. Navigate to **Config → Pricing**.
2. Review the price history table.
3. Try setting a new price (station, grade, cost per litre, sell price, valid from date).

> **What to check:**
> - Is the price history table clear?
> - Is it obvious what "valid from" means?
> - Are cost vs sell price clearly labelled?

**Feedback:**

---

### Step 4.12 — Product Catalogue

1. Navigate to **Config → Products**.
2. Select a station.
3. Review the product list.
4. Try expanding a product — review the edit and pricing sections.
5. Try adding a new product (or editing an existing one).
6. Try deactivating a product.

> **What to check:**
> - Is the product list easy to scan?
> - Is the difference between "edit details" and "update pricing" clear?
> - Is deactivating/reactivating obvious and safe (no accidental clicks)?

**Feedback:**

---

### Step 4.13 — Opening Baselines

1. Navigate to **Config → Baselines**.
2. Select a station.
3. Review the pump meter and tank dip baseline fields.
4. Try updating one value.

> **What to check:**
> - Is it clear what a "baseline" is for? (Starting point when no prior shift exists)
> - Are the pump and tank labels clear?
> - Is any guidance text helpful or missing?

**Feedback:**

---

### Step 4.14 — User Management

1. Navigate to **Users**.
2. Review the user table — email, role, station, status.
3. Try inviting a new user (use a test email address, don't send to a real person unless intended).
4. Review the status options (active, pending, inactive).

> **What to check:**
> - Is the invite flow clear?
> - Are role names (supervisor, cashier, owner) self-explanatory?
> - Is the status display meaningful?
> - Is deactivating a user clearly labelled?

**Feedback:**

---

---

# Feature Checklist

Mark each item: **Pass / Fail / Partial / Not Tested**

## Authentication
- [ ] Login with email and password
- [ ] Magic link login
- [ ] Forgot password flow
- [ ] Set password (new user invite flow)
- [ ] Role-based redirect after login (supervisor → /shift, cashier → /cashier, owner → /dashboard)
- [ ] Logout

## Supervisor — Shift Workflow
- [ ] Create new shift
- [ ] Block duplicate shift creation (same station/period/date)
- [ ] Enter pump meter readings (all pumps)
- [ ] Pump progress counter updates correctly
- [ ] Flag pump as maintenance required on close reading
- [ ] Enter tank dip readings (all tanks)
- [ ] Dip progress counter updates correctly
- [ ] Add fuel delivery (tank, litres, optional photo)
- [ ] Remove fuel delivery
- [ ] Summary checklist shows Cashier row as Pending before cashier submits
- [ ] Submit button blocked until cashier has submitted
- [ ] Submit shift succeeds after cashier submits
- [ ] Shift status changes to Closed after submit
- [ ] Reconciliation tables render correctly (tank inventory, pump vs POS)
- [ ] Flag a closed shift with comment
- [ ] Unflag a shift
- [ ] Override a pump reading with reason
- [ ] Override a dip reading with reason
- [ ] Override a POS line with reason
- [ ] Audit trail shows original → override history
- [ ] Correction form collapses after save

## Supervisor — Price Change Split Workflow
- [ ] Price change split option is visible when eligible
- [ ] Split pumps step (Part 1 close readings)
- [ ] Split dips step (Part 1 close readings)
- [ ] Split POS step (interim Z-report)
- [ ] Split confirm step (review before confirming)
- [ ] Part 2 shift is created after split confirm
- [ ] Shift labels correctly show Part 1 / Part 2

## Cashier Workflow
- [ ] Cashier home lists open (pending) shifts for their station
- [ ] Cashier hub shows three sections with progress indicators
- [ ] Submit button disabled until all sections complete
- [ ] Enter fuel POS (litres + revenue per grade)
- [ ] Enter dry stock POS (units + revenue per product)
- [ ] Enter stock count (closing count per product)
- [ ] Submit cashier shift — sections lock
- [ ] Submission timestamp shown
- [ ] Cashier summary shows fuel sales
- [ ] Cashier summary shows dry stock variance (expected vs actual, colour coded)

## Owner — Reports
- [ ] Dashboard home shows per-station cards with inventory and pending/flagged info
- [ ] Create shift slot from dashboard
- [ ] Daily fuel control report (station + month filters)
- [ ] Variance colour coding (red/amber/green)
- [ ] Weekly report (station + week filters)
- [ ] Weekly CSV export
- [ ] Monthly report with totals row
- [ ] Dry stock report (station + date range filters)
- [ ] Deliveries report with pagination
- [ ] Deliveries CSV export
- [ ] Deliveries receipt photo link
- [ ] Tank trends chart with preset and custom date range
- [ ] Delivery markers on tank trends chart
- [ ] Shift history with all filters (date, station, period, status, supervisor)
- [ ] Shift history detail — all sections present (pumps, dips, POS, reconciliation, audit)
- [ ] Override history visible in shift detail
- [ ] Maintenance required flag visible in shift detail
- [ ] Flag/unflag from shift detail

## Owner — Configuration
- [ ] View station tree (stations, tanks, pumps)
- [ ] Add new station
- [ ] Edit station details
- [ ] Add tank to station
- [ ] Edit tank (label, grade, capacity)
- [ ] Add pump to station
- [ ] Edit pump
- [ ] Set fuel price (grade, cost, sell, valid from)
- [ ] View price history
- [ ] Add product to catalogue
- [ ] Edit product details
- [ ] Update product pricing
- [ ] Deactivate / reactivate product
- [ ] Set opening baselines (pump meters + tank dips)
- [ ] Invite user (email, role, station)
- [ ] View user list with status
- [ ] Deactivate user

## General / Cross-Cutting
- [ ] App loads correctly on mobile (phone-sized screen)
- [ ] App loads correctly on tablet
- [ ] Navigation between pages works (no dead links)
- [ ] No visible console errors during normal use
- [ ] Loading states shown during data fetches
- [ ] Error messages shown when actions fail
- [ ] Forms validate required fields before submit
- [ ] Currency values display in ZAR format (R symbol, 2 decimal places)
- [ ] Volumes display in litres with sensible formatting
- [ ] Negative variances shown in red, zero in green

---

---

# General Feedback

Use this section for any observations that don't fit a specific step.

**Overall first impression:**

**Biggest pain point encountered:**

**Feature you expected to exist but couldn't find:**

**Anything that felt polished or well-done:**

**Any other comments:**

---

_End of guide._
