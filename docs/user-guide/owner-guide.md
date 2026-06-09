# Owner Guide

This guide is for owners and administrators. As an owner you can view cross-station reports, manage station configuration, create shift slots, and manage users.

## Getting started

After logging in you are taken to the **Owner Dashboard** at `/dashboard`. This is your central hub. The navigation bar gives you access to reports, configuration, and user management.

---

## Owner Dashboard

The dashboard shows a card for each station. Each card displays:

- **Station name**
- **Pending count** — the number of shifts in progress today (shown as a yellow badge if any exist).
- **Flagged shifts** — any shifts flagged by supervisors today, with the flag comment (shown in red).
- **Current fuel inventory** — litres on hand per fuel grade, cost per litre, and total inventory value in ZAR, based on the most recent closed shift's dip readings.

### Creating a shift slot

Before a supervisor can begin a shift close, you must create the shift slot.

1. On the dashboard, scroll to the **Create shift slot** section.
2. Select the **Station**.
3. Select the **Period** (Morning or Evening).
4. Set the **Date** (defaults to today).
5. Click **Create**.

The slot appears in the supervisor's shift list so they can begin the close check.

> **Note:** You cannot create a slot for a station/period/date combination that already has a shift.

---

## Reports

From the dashboard, click **Reports** in the navigation bar to access the reporting section.

### Fuel Control Report

The main reports page shows the **Fuel Control Report** — a monthly breakdown of fuel variance by shift.

- **Filter by station** using the Station dropdown.
- **Filter by month** using the Month dropdown (up to 23 months of history available).
- Click **View** to apply filters.

The table shows each shift day's results per fuel grade, with:

- Tank variance (litres)
- POS revenue variance (ZAR)
- Colour coding: red = loss, amber = overage, green = no variance.

Click on a shift row to view the full shift detail.

### Dry Stock Report

Click **Dry Stock** in the report navigation to view dry stock variance by shift. This shows closing stock counts, POS sales, and variance per product per shift.

### Deliveries Report

Click **Deliveries** to view a paginated list of all fuel deliveries across stations, with totals and per-station subtotals. Delivery note photos can be viewed by clicking the **Receipt** link on any delivery row.

### Weekly and Monthly Reports

Access weekly and monthly summary reports from the navigation bar. These aggregate variance and revenue data across stations for the selected period.

### Shift History

Click **History** in the navigation to view a filterable list of all shifts:

- Filter by date range, station, period, status, supervisor, or whether the shift has manual entries.
- The table shows each shift's date, station, period, supervisor, submission time, status, tank variance, and revenue variance.
- Click **View** on any row to see the full shift detail including reconciliation results, audit trail, and any corrections made.

### Tank Trends

Click **Tank trends** in the navigation to view a chart of tank fuel levels over time per station. This helps identify unusual patterns in inventory levels.

### Exporting data

The fuel control report and deliveries report each have an **Export** link that downloads a CSV file of the current filtered view.

---

## Station Configuration

Click **Config** in the navigation to manage stations, tanks, pumps, pricing, products, and baselines.

### Viewing the station tree

The Config page shows a tree of all stations, their tanks, and their pumps. Expanding a station shows its tanks and the pumps connected to each tank.

### Adding a station

1. On the Config page, click **Add station**.
2. Enter the station name and any required details.
3. Save.

### Managing tanks and pumps

1. Click on a station in the tree to open its detail page.
2. From there you can add tanks (specifying the fuel grade and capacity) and add pumps (linking each pump to a tank).

### Setting fuel prices

1. On the Config page, click **Fuel pricing**.
2. Select a station and fuel grade.
3. Enter the new sell price and cost price per litre, and the date from which the price is valid.
4. Save.

Fuel prices have validity windows — a price is active from its **Valid from** date until the next price for the same grade takes effect. This ensures historical reconciliation uses the correct prices.

> **Note:** If a price change happens mid-shift, supervisors should use the **Price change split** feature to close Part 1 of the shift before the price change and continue with Part 2 at the new price.

### Managing dry stock products

1. On the Config page, click **Products**.
2. Add products with a stock code, description, and selling price.
3. Mark products as active or inactive. Only active products appear in the cashier's stock count and POS screens.

### Setting baselines

Baselines are starting inventory levels used when no prior shift exists to carry forward from.

1. On the Config page, click **Baselines**.
2. Select a station.
3. Enter the baseline quantity for each tank (fuel) or product (dry stock).

---

## User Management

Click **Users** in the navigation to manage user accounts.

### Inviting a new user

1. On the Users page, click **Invite user**.
2. Enter the user's email address.
3. Select their **Role** (supervisor or cashier).
4. Select the **Station** they will work at.
5. Click **Send invite**.

The user receives an email with a link to set their password. The link expires after a short period — if it expires, use the invite button again to send a new one.

### Deactivating a user

Find the user in the list and click the deactivate option. Deactivated users cannot log in. Their historical data is preserved.

---

## Troubleshooting

**A station card shows "No closed shift data".**
No shifts have been closed for that station yet, or no closing dip readings exist. Once a supervisor closes a shift with dip readings, the inventory will appear.

**A shift is showing as flagged.**
A supervisor has flagged the shift to indicate a discrepancy. Click the shift in the history to view the flag comment and the reconciliation detail. If the issue has been resolved, the supervisor can remove the flag from the shift summary.

**A shift is stuck as pending.**
The supervisor has not yet submitted. You can view their progress by opening the shift in history. If needed, contact the supervisor directly.

**The Fuel Control Report shows no data for a month.**
No shifts were closed for the selected station in that month. Check whether shifts were created and submitted for that period using the Shift History filter.

**A user's invite link has expired.**
The user will see an error message on the login screen. Go to Users, find the user, and send a new invite.
