# Supervisor Guide

This guide is for supervisors at Elegant Amaglug, Speedway, and Truck Stop. As a supervisor you close fuel shifts, capture pump meter and tank dip readings, record deliveries, flag discrepancies, and submit shifts for reconciliation.

## Getting started

After logging in you are taken to the **Shifts** screen (`/shift`). This shows today's shifts for your station and their status.

- **Pending** — a shift that is open and waiting for close readings.
- **Closed** — a shift that has been submitted and reconciled.
- **Flagged** — a closed shift that has been marked as having a discrepancy.

If a pending shift exists for the current period you will be taken directly to the pump readings screen.

---

## Creating a shift

> **Note:** An owner must create a shift slot before you can start. If no shift appears for today's period, contact your owner.

If no shift exists for the current period:

1. On the **Shifts** screen, click **Create shift**.
2. Select the **Period** (Morning or Evening). The current period is pre-selected.
3. Click **Begin close check**.

The app will redirect you to the pump meter readings screen.

---

## Closing a shift

Closing a shift involves four steps shown in the progress bar at the top of the screen:

1. **Pump readings** — enter the closing meter reading for each pump.
2. **Dip readings** — enter the closing fuel level for each tank.
3. **Deliveries** — record any fuel deliveries that arrived during this shift (optional if none occurred).
4. **Review and submit** — confirm all readings are complete and submit the shift.

You can move between steps using the buttons at the bottom of each screen, or by clicking the steps in the progress bar.

### Step 1: Pump meter readings

Each pump at your station is shown one at a time on a scrollable carousel.

1. For each pump, enter the **closing meter reading** shown on the pump display, in litres.
2. If a pump requires maintenance, check the **maintenance required** checkbox.
3. Click **Save** to record the reading and advance to the next pump.

A pump turns green in the carousel when its reading has been saved. You can go back and update a reading by tapping the pump again.

> **Tip:** Enter readings in the order you walk the forecourt so you don't miss any pumps.

When all pumps are saved, the count at the top shows "X/X pumps". You can then proceed to dip readings.

### Step 2: Dip readings

Each tank at your station is listed on this screen.

1. For each tank, enter the **closing dip reading** in litres. The tank label and fuel grade are shown to help you identify the correct tank.
2. Click **Save** next to each tank.

The screen shows how many tanks have been saved (e.g. "3/4 tanks"). Proceed to deliveries once all tanks are done.

### Step 3: Deliveries

If a fuel delivery was received during this shift:

1. Select the **Tank** from the dropdown.
2. Enter the **litres received**.
3. Optionally, take a photo of the **delivery note** using the photo button.
4. Click **Add delivery**.

The delivery will appear in the list above the form. To remove a delivery, click **Remove** next to it.

If no delivery occurred during this shift, leave this screen empty and proceed to **Review and submit**.

### Step 4: Review and submit

This screen shows a checklist:

- **Pump readings** — shows how many pumps are complete (e.g. "18/18"). Click **Go** if any are missing.
- **Dip readings** — shows how many tanks are complete. Click **Go** if any are missing.
- **Cashier** — shows whether the cashier has submitted their portion of the shift. This is read-only; you do not need to wait for the cashier before submitting.
- **Deliveries** — shows the number of deliveries recorded. Click **Manage** to add or remove deliveries.

When all pump and dip readings are complete, the **Submit and close shift** button becomes active.

1. Click **Submit and close shift**.
2. The shift is closed and reconciliation runs automatically.
3. You are shown the closed shift summary with reconciliation results.

> **Warning:** Submitting is final. If you need to correct a reading after submission, use the **Correct a reading** section on the closed shift summary page.

---

## Understanding the closed shift summary

After submitting, the shift summary shows the reconciliation results.

### Tank Inventory section

For each tank:

| Row | Meaning |
|---|---|
| Opening dip | Fuel level at the start of the shift (in litres) |
| Deliveries | Any fuel received during the shift |
| Meter delta | Total fuel dispensed according to pump meters |
| Expected closing | What the tank level should be: Opening + Deliveries − Meter delta |
| Actual closing | The dip reading you entered |
| **Variance** | Actual − Expected. Negative (red) = loss. Positive (amber) = overage. |

### Pump Meter vs POS — Revenue section

For each pump, a table shows:

- **Meter delta (L)** — litres dispensed according to the pump meter
- **POS (L)** — litres reported sold by the POS system
- **Var (L)** — difference between meter and POS litres
- **POS Revenue** — revenue reported by POS
- **Expected Revenue** — litres × selling price
- **Var (ZAR)** — revenue shortfall or overage

Subtotals are shown per fuel grade.

---

## Flagging a shift

If you notice a discrepancy in a closed shift, you can flag it for the owner's attention.

1. Open the closed shift summary.
2. Scroll to the **Flag this shift** section.
3. Enter a description of the issue in the text box.
4. Click **Flag shift**.

The shift will be marked **Flagged** (shown in red on the shift list). The owner can see the flag and the comment in the dashboard and history view.

To remove a flag:

1. Open the shift summary.
2. Click **Remove flag** in the flag section.

---

## Correcting a reading

If a reading was entered incorrectly after a shift is closed, you can submit a correction. All corrections are logged with a reason and your name.

1. Open the closed shift summary.
2. Scroll to the **Correct a reading** section.
3. Find the pump, dip, or POS line you need to correct and click on it to expand the form.
4. Enter the **corrected value**.
5. Enter a **reason** for the change.
6. Click **Save correction**.

The reconciliation recalculates automatically after a correction is saved.

Corrections that have been made are shown in the **Correction history** section at the bottom of the page.

---

## Splitting a shift (price change)

A shift split is used when a fuel price change occurs mid-shift. Splitting closes Part 1 of the shift at the mid-point and creates Part 2 with opening readings carried over.

> **Note:** You can only split a shift that is still pending and has not been split before.

1. On the **Shifts** screen, find the pending shift and click **Price change split**.
2. Enter the closing pump meter readings for Part 1.
3. Enter the closing dip readings for Part 1.
4. Enter the POS totals for Part 1.
5. On the **Confirm split** screen, click to confirm.

Part 1 is closed and Part 2 opens automatically with the same opening readings as Part 1's closing readings. Continue the normal shift close workflow for Part 2.

---

## Troubleshooting

**The Submit and close shift button is greyed out.**
Not all required readings have been saved. Check the checklist — any item showing a count less than the total (e.g. "5/6 pumps") needs to be completed. Click **Go** next to the incomplete item.

**I can't create a shift.**
An owner needs to create the shift slot first. Contact your owner.

**I submitted the shift but the reconciliation is not showing.**
Reconciliation can take a moment to process. Refresh the page. If it still shows "Reconciliation is being processed" after a minute, contact your owner.

**A pump's meter reading is clearly wrong (e.g. the meter was replaced).**
Save the reading shown on the pump. After submitting, use the **Correct a reading** section to enter the correct value and provide a reason explaining the meter replacement.
