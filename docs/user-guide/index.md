# FuelTracker — User Guide

FuelTracker is a web app used by South African petrol stations to track fuel inventory, record shift readings, and produce variance reports. This guide covers all three user roles.

## Stations covered

- Elegant Amaglug
- Speedway
- Truck Stop

## Roles

| Role | What they do |
|---|---|
| **Supervisor** | Opens and closes fuel shifts, captures pump meter readings and tank dip readings, records fuel deliveries, flags issues, and submits shifts. |
| **Cashier** | Captures POS Z-report totals (fuel and dry stock), counts closing stock, and submits the cashier portion of a shift. |
| **Owner** | Views cross-station reports, manages station configuration, creates shift slots, and manages users. |

## Glossary of terms

**Shift** — A defined work period (morning or evening) during which fuel sales and meter readings are captured. Two shifts run per day at each station.

**Dip reading** — A manual measurement of fuel volume in an underground tank, recorded in litres. Taken at the start and end of each shift.

**Pump meter reading** — The cumulative litre counter on a fuel pump. The difference between the opening and closing readings tells you how much fuel was dispensed.

**POS Z-report** — A printout from the Point of Sale system summarising total sales for a period, broken down by fuel grade. Cashiers enter these figures into FuelTracker.

**Reconciliation** — An automatic calculation that compares meter readings, dip readings, and POS sales to identify any fuel or revenue variance.

**Variance** — The difference between expected and actual figures. A negative variance (shown in red) means a loss. A positive variance (shown in amber) means an overage.

**Fuel grade** — The type of fuel: 95 Unleaded (95), 93 Unleaded (93), Diesel 10ppm (D10), or Diesel 50ppm (D50).

## Logging in

1. Open the FuelTracker app in your browser.
2. Enter your **Email** and **Password**, then click **Sign in**.
3. You will be taken to the home screen for your role.

> **Forgot your password?** Click **Forgot password?** below the sign-in button. Enter your email address and click **Send reset link**. A link will arrive in your inbox — click it to set a new password.

> **New user?** Click the link in your invite email. You will be prompted to set a password before logging in for the first time. If the invite link has expired, ask an owner to send a new invite.

## Guides by role

- [Supervisor Guide](supervisor-guide.md) — shift close workflow, deliveries, flagging, corrections
- [Cashier Guide](cashier-guide.md) — Fuel POS, dry stock POS, stock count, submission
- [Owner Guide](owner-guide.md) — dashboard, reports, configuration, user management
