# PRD: FuelTracker v3 — Multi-Station Fuel Inventory Tracking System

## Problem Statement

Operators of a chain of fuel stations currently have no reliable, centralised system to track fuel inventory across shifts. Attendants manually record pump meter readings and tank dip measurements on paper, and supervisors reconcile these against point-of-sale (POS) summaries at the end of each shift — a process that is error-prone, slow, and provides no real-time visibility into variances, losses, or discrepancies. Photos of pumps are not taken systematically, creating gaps in the audit trail. Fuel deliveries are tracked informally, making it difficult to reconcile inventory changes against received stock. Owners have no cross-station dashboard and must chase paper records to understand daily performance, revenue variances, or potential theft.

## Solution

A mobile-responsive Progressive Web App (PWA) that guides attendants through a structured shift workflow: photographing each pump at shift open and close (with automatic OCR extraction of meter readings), recording tank dip readings, and photographing the POS Z-report at shift end (with OCR extraction of sales data by fuel grade). The system automatically runs two reconciliation formulas — tank inventory and pump-meter-vs-POS — on every shift submission, and calculates expected vs actual revenue in ZAR. Supervisors review and approve submissions with full photo audit trails. Owners access daily, weekly, and monthly reports across all stations. The system works offline and syncs when connectivity is restored.

---

## User Stories

### Attendant — Shift Open

1. As an attendant, I want to log in with my email and password, so that my submissions are attributed to me personally.
2. As an attendant, I want to select my station and shift period (morning or evening) when starting a shift, so that the system knows which station and time slot this data belongs to.
3. As an attendant, I want the app to show me a list of all pumps at my station, so that I know exactly which pumps need readings captured.
4. As an attendant, I want to take a photo of each pump's meter at shift open, so that there is photographic evidence of the opening meter reading.
5. As an attendant, I want the app to automatically extract the meter reading from my pump photo using OCR, so that I don't have to manually type every reading.
6. As an attendant, I want to confirm or correct the OCR-extracted pump meter reading before submitting, so that I can catch any misreads.
7. As an attendant, I want to mark a pump photo as unreadable and enter the meter reading manually, so that poor lighting or camera issues don't block my submission.
8. As an attendant, I want to enter the opening dip reading (in litres) for each tank at my station, so that the system has the opening inventory for reconciliation.
9. As an attendant, I want a progress indicator showing how many pumps and tanks I've completed, so that I don't accidentally skip any.
10. As an attendant, I want to save my shift open data as a draft and come back to it, so that I can handle interruptions without losing my work.

### Attendant — Shift Close

11. As an attendant, I want to photograph each pump's meter at shift close, so that the closing meter reading is captured with photographic evidence.
12. As an attendant, I want the app to OCR-extract the closing meter reading and ask me to confirm, so that I only need to correct exceptions.
13. As an attendant, I want to enter the closing dip reading (in litres) for each tank, so that the system can calculate how much fuel remained at shift end.
14. As an attendant, I want to photograph the POS Z-report printout at shift end, so that the sales data is captured from the point-of-sale system.
15. As an attendant, I want the app to OCR-extract each line of the Z-report (fuel grade, litres sold, revenue) and show me the extracted values, so that I can verify them before submitting.
16. As an attendant, I want to correct any OCR-extracted Z-report values line by line, so that errors in automated extraction don't propagate into the reconciliation.
17. As an attendant, I want to mark the Z-report photo as unreadable and enter sales figures manually, so that a poor-quality printout doesn't block my shift submission.
18. As an attendant, I want to submit my completed shift, so that it goes to my supervisor for review.
19. As an attendant, I want confirmation that my shift was submitted successfully, so that I can confidently end my shift knowing the data was received.

### Attendant — Offline

20. As an attendant, I want to capture pump photos and enter readings even when I have no internet connection, so that I can complete my shift in a low-signal environment.
21. As an attendant, I want to see how many offline actions are pending sync, so that I know the data hasn't been lost.
22. As an attendant, I want offline actions to sync automatically when my device reconnects, so that I don't have to remember to manually submit.
23. As an attendant, I want to be notified when an offline sync succeeds or fails, so that I know if anything needs attention.

### Supervisor — Shift Review

24. As a supervisor, I want to see a list of all submitted shifts at my station pending review, so that I can work through them systematically.
25. As a supervisor, I want to open a shift and see all pump photos, confirmed meter readings, dip readings, POS photo, and extracted sales data in one view, so that I can review the full submission.
26. As a supervisor, I want to see the automatic reconciliation results (tank variance, pump-meter-vs-POS variance, revenue variance) alongside the submission, so that I can assess whether the numbers are acceptable.
27. As a supervisor, I want to approve a shift submission, so that it is marked as reviewed and locked.
28. As a supervisor, I want to flag a shift for follow-up with a comment, so that I can note an issue without blocking the audit trail.
29. As a supervisor, I want to override an OCR-confirmed value on a pump reading or POS line after submission, so that I can correct a mistake an attendant missed.
30. As a supervisor, I want an override to be recorded with my name and a reason, so that the audit trail shows who changed what.
31. As a supervisor, I want to see all flagged shifts in a separate view, so that I can track open issues.

### Supervisor — Deliveries

32. As a supervisor, I want to record a fuel delivery by selecting the tank, entering litres received, and photographing the delivery note, so that stock received is tracked accurately.
33. As a supervisor, I want deliveries to be timestamped automatically, so that the reconciliation engine knows which shift period they fall within.
34. As a supervisor, I want to see a history of all deliveries at my station, so that I can verify stock received against supplier invoices.

### Owner / Admin — Dashboard & Reports

35. As an owner, I want a cross-station dashboard showing the current status of today's shifts at every station, so that I can see at a glance whether all shifts have been submitted and reviewed.
36. As an owner, I want a daily variance report per station showing opening dip, deliveries, POS sales, expected closing dip, actual closing dip, and tank variance for each tank, so that I can identify inventory losses or gains each day.
37. As an owner, I want a daily report showing the pump-meter-vs-POS variance per fuel grade per station, so that I can identify discrepancies between pump meter data and POS sales.
38. As an owner, I want a daily financial summary per station showing expected revenue (litres sold × price per grade) vs POS reported revenue, and the ZAR variance, so that I can identify revenue leakage.
39. As an owner, I want to view weekly and monthly aggregated versions of the daily reports, so that I can spot trends over time.
40. As an owner, I want to browse the full shift history for any station, filtered by date, shift period, attendant, or status, so that I can audit any past submission.
41. As an owner, I want to click into any historical shift and view all photos, readings, OCR extractions, overrides, and reconciliation results, so that I have a complete audit trail.
42. As an owner, I want a tank level trend chart per tank per station over a selectable date range, so that I can visually spot slow leaks or unusual depletion patterns.
43. As an owner, I want to export reports to CSV, so that I can load them into external accounting or spreadsheet tools.

### Owner / Admin — Configuration

44. As an owner, I want to create and configure stations (name, address), so that the system reflects the real-world chain.
45. As an owner, I want to configure tanks per station (label, fuel grade, capacity in litres), so that dip readings are associated with the correct physical tank.
46. As an owner, I want to configure pumps per station and map each pump to a tank, so that pump meter readings can be attributed to the correct fuel grade.
47. As an owner, I want to update the pump-to-tank mapping when physical plumbing changes, so that the configuration stays accurate.
48. As an owner, I want to set the selling price per fuel grade in ZAR per litre, so that the financial reconciliation uses correct figures.
49. As an owner, I want selling price changes to be versioned and timestamped, so that historical reconciliations use the price that was active at the time of the shift.

### Owner / Admin — User Management

50. As an owner, I want to invite users by email and assign them a role (attendant, supervisor) and station, so that access is controlled and attributed correctly.
51. As an owner, I want to change a user's role or station assignment, so that I can accommodate staff changes.
52. As an owner, I want to deactivate a user account without deleting it, so that the audit trail is preserved when someone leaves.
53. As an owner, I want to see a list of all users across all stations with their roles and last-login date, so that I can manage the team.

---

## Implementation Decisions

### Module Architecture

**15 modules across 4 layers:**

**Infrastructure Layer (no business logic, fully isolated):**

1. **OCR Service** — wraps Google Cloud Vision API. Two operations: extract pump meter reading from an image, and extract POS Z-report lines from an image. Returns structured output with a confidence score. All callers interact through this interface; Google Vision is never called directly. Can be mocked in tests.

2. **Photo Storage** — wraps Supabase Storage. Handles upload, deletion, and signed URL generation. File paths follow a convention keyed by station/shift/type. No business logic.

3. **Offline Queue** — IndexedDB-backed queue with a service worker sync trigger. Callers enqueue typed actions (pump reading, dip reading, POS submission). On reconnect, the queue drains in order. Handles retries, deduplication, and notifies the UI of pending count and sync status.

**Domain Layer (business logic):**

4. **Station Config** — manages stations, tanks, pumps, pump-to-tank mappings, and fuel grades. Owner-only writes. Read access for all authenticated users at the relevant station. Stable interface; rarely changes after initial setup.

5. **Shift** — state machine with states: `draft`, `open`, `submitted`, `approved`, `flagged`. Transition rules enforced server-side: cannot move to `submitted` unless all pumps and tanks have confirmed readings and a POS submission exists. Cannot re-open an approved shift. Emits events on transition for downstream modules.

6. **Pump Reading** — stores opening and closing meter readings per pump per shift. Each reading has: photo URL, OCR-extracted value, confirmed value, and OCR status (`auto` / `manual_override` / `unreadable`). Linked to a specific shift and pump.

7. **Dip Reading** — stores opening and closing tank dip levels in litres per tank per shift. No OCR; values entered directly by attendant.

8. **POS Submission** — stores the Z-report photo URL, raw OCR JSON from Google Vision, and the attendant-confirmed sales lines (fuel grade, litres sold, revenue in ZAR). One submission per shift.

9. **Delivery** — stores fuel deliveries recorded by supervisors: station, tank, litres received, delivery note photo URL, timestamp. Deliveries are associated to a shift period based on timestamp. Used as input to reconciliation.

10. **Reconciliation Engine** — pure function module. Takes a shift ID and reads all associated data (opening dip, closing dip, deliveries in range, pump meter deltas, confirmed POS sales, active fuel prices). Outputs: tank variance per tank, pump-meter-vs-POS variance per grade, expected revenue, POS revenue, and revenue variance. Runs automatically on shift submission. Results stored in a reconciliation record linked to the shift. No side effects — all inputs read-only.

11. **Pricing** — stores selling price per fuel grade in ZAR/litre. All price changes are versioned with a timestamp and the owner's user ID. Reconciliation Engine always queries the price active at the time of shift submission.

**Application Layer (orchestration, thin):**

12. **Supervisor Review** — aggregates shift data, pump readings, dip readings, POS submission, delivery records, and reconciliation results into a single view. Handles approve and flag actions. Handles post-submission OCR override (writes override record, re-runs reconciliation).

13. **Report** — generates daily, weekly, and monthly report data per station. Aggregates reconciliation records. Queries tank level time series for trend charts. Supports CSV export. Cross-station aggregation for owner dashboard.

**Security Layer:**

14. **Auth + RBAC** — Supabase Auth for authentication (email + password, magic link). Roles stored in a `user_profiles` table. Row-Level Security (RLS) policies on all tables enforce that attendants and supervisors only read/write data for their assigned station. Owner role bypasses station filtering. All role checks happen at the database layer, not just in application code.

15. **User Management** — owner-only module for inviting users (Supabase Auth invite), assigning roles and stations, updating assignments, and deactivating accounts. Deactivation revokes auth access without deleting records.

### Database Schema (Postgres via Supabase)

Core tables: `stations`, `tanks`, `pumps`, `fuel_grades`, `fuel_prices` (versioned), `user_profiles`, `shifts`, `pump_readings`, `dip_readings`, `pos_submissions`, `pos_submission_lines`, `deliveries`, `reconciliations`, `reconciliation_tank_lines`, `reconciliation_grade_lines`, `ocr_overrides`.

Row-Level Security applied to all tables. Station-scoped access enforced via foreign key to `station_id` and user's `station_id` in their profile.

### OCR Strategy

- **Pump meter**: image uploaded to Supabase Storage, URL passed to OCR Service. Response parsed for a numeric meter value. If confidence below threshold, status set to `needs_review` and attendant prompted to confirm.
- **POS Z-report**: image passed to OCR Service which extracts a structured array of `{grade, litres_sold, revenue}` lines. Attendant reviews line by line. If OCR fails entirely, attendant enters all values manually.
- Google Cloud Vision Document AI used for both; prompt engineering applied to improve structured extraction from low-quality printout photos.

### Offline Architecture

- PWA with a service worker registered at app load.
- Captured photos are stored in IndexedDB (as blobs) alongside the form data.
- On reconnect, the Offline Queue drains: photos uploaded to Supabase Storage first, then readings submitted via Server Actions with the returned storage URLs.
- Conflict rule: server state wins. If a shift was already submitted by another session, the queued submission is rejected and the user notified.

### Reconciliation Timing

- Reconciliation runs immediately on shift submission (server-side, triggered by the Shift module's `submitted` transition).
- If a supervisor overrides an OCR value, reconciliation re-runs against the updated data.
- If a delivery is added or edited after shift submission, reconciliation re-runs for the affected shift.

### Financial Reconciliation

- Selling price is looked up at the time of shift submission (versioned pricing table).
- Expected Revenue = sum over grades of (POS litres sold × price per litre at shift time).
- Revenue Variance = Expected Revenue − POS Reported Revenue (in ZAR).
- Both values stored on the reconciliation record.

---

## Testing Decisions

**What makes a good test:** Tests should verify observable behaviour through the module's public interface, not its internal implementation. A test should describe what the system does, not how it does it. Tests should be fast, deterministic, and isolated from external services (use mocks/fakes for Google Vision, Supabase Storage, and the database where needed).

### Modules to Test

**Reconciliation Engine — Unit Tests**
- Formula 1 (tank variance): correct result when deliveries present; correct result with zero deliveries; correct result when opening dip equals closing dip; negative variance (unexplained gain); positive variance (loss).
- Formula 2 (pump meter vs POS): correct aggregation across multiple pumps of the same grade; mismatch detected correctly.
- Financial: correct expected revenue calculation; correct variance when POS revenue differs; uses price active at shift time (not current price).
- Edge cases: shift with no POS sales recorded; shift with no deliveries; grade with pumps but no POS line.

**OCR Service — Unit Tests (with mocked Google Vision responses)**
- Pump meter extraction: clean photo response → correct value; low confidence response → `needs_review` flag; malformed response → graceful error.
- POS extraction: clean Z-report → correct structured lines; partial extraction → returns what was found + flags missing lines; empty response → returns empty array, not an error.

**Shift State Machine — Unit Tests**
- Valid transitions: draft → open → submitted → approved; draft → open → submitted → flagged.
- Invalid transitions: submitted → open (rejected); approved → submitted (rejected); flagged → approved without supervisor action (rejected).
- Submission guard: shift with incomplete pump readings cannot transition to submitted; shift with missing dip readings cannot transition to submitted; shift with no POS submission cannot transition to submitted.

**Offline Queue — Unit Tests**
- Enqueue adds action to IndexedDB.
- Sync drains queue in FIFO order.
- Failed sync item is retried up to a max retry count, then marked as failed.
- Duplicate enqueue of same action is deduplicated.
- Pending count is accurate before and after sync.

**End-to-End Tests (Playwright)**
- Full attendant shift open flow: login → select station/shift → capture all pump readings (mocked OCR) → enter all dip readings → submit open.
- Full attendant shift close flow: capture close readings → photograph Z-report (mocked OCR) → confirm sales lines → submit shift.
- Supervisor review flow: login as supervisor → view submitted shift → approve shift → verify reconciliation results visible.
- Owner report flow: login as owner → view daily report for a station → verify variance data matches expected.
- Offline flow: disable network → capture readings → re-enable network → verify sync completes and shift appears as submitted.

---

## Out of Scope

- Native mobile app (iOS/Android). This is a mobile-responsive PWA only.
- SMS or email notifications. Supervisors review shifts manually in-app.
- Supplier portal or delivery driver login. Deliveries are recorded by supervisors.
- Direct POS system integration. Sales data is captured via Z-report photo + OCR only.
- Procurement, cost price tracking, or margin analysis. Financial module covers selling price and revenue variance only.
- Automated variance alerts or threshold-based notifications. All review is manual.
- Multi-tenant SaaS (separate paying customers). This is a single-company deployment.
- mm-to-litre dip chart conversion. Attendants read litres directly from the physical dip chart and enter the value.
- Per-attendant pump assignment. Any attendant can record any pump.

---

## Further Notes

- **Currency**: All financial figures are in ZAR (South African Rand).
- **Fuel grades in use**: 95 (unleaded), 93 (unleaded), D10 (diesel), D50 (diesel). Grades are configurable by admin.
- **Station scale**: Largest station (Speedway) has 36 pumps and 6 tanks. The pump photo capture flow must be efficient at this scale — consider a quick-scan list UI where attendants work through pumps sequentially rather than selecting individually.
- **Photo volume**: At Speedway, a single shift generates up to 72 pump photos (36 open + 36 close) plus 1 Z-report photo. Storage costs and upload performance must be considered. Photos should be compressed client-side before upload.
- **Pricing versioning**: Because fuel prices in South Africa change regularly (controlled by government), the versioned pricing table is essential for accurate historical reconciliation.
- **Reconciliation per tank vs per grade**: Tank reconciliation operates at the tank level (each tank holds one grade). Pump-meter-vs-POS reconciliation operates at the grade level (aggregate across all pumps feeding tanks of the same grade). Both need clear labelling in the UI to avoid confusion.
- **Audit trail immutability**: Once a shift is approved, underlying pump readings and dip readings should be immutable. Any corrections post-approval go through the OCR Override record, preserving the original values.
