## Parent PRD

#2

## What to build

Build the Fuel Deliveries module. Supervisors record fuel deliveries against a specific tank: entering litres received, photographing the delivery note, and confirming the timestamp. Deliveries are automatically factored into reconciliation for the shift period they fall within. When a delivery is added or edited, reconciliation re-runs for the affected shift.

## Acceptance criteria

- [ ] Table: `deliveries` created with migrations and RLS
- [ ] Supervisor can record a delivery: select station, select tank, enter litres received, upload delivery note photo, confirm timestamp (auto-filled, editable)
- [ ] Delivery note photo uploaded to Supabase Storage
- [ ] Delivery timestamp determines which shift period it belongs to (morning = before midday, evening = after midday)
- [ ] When a delivery is saved, reconciliation re-runs for the affected shift if that shift is already submitted
- [ ] Supervisor can edit a delivery (litres or timestamp); reconciliation re-runs on edit
- [ ] Supervisor sees delivery history for their station: tank, litres, timestamp, delivery note photo link
- [ ] Owner sees delivery history across all stations
- [ ] RLS: supervisors and owners can create/edit deliveries; attendants have no access

## Blocked by

- Blocked by #12 (Slice 8: shift submission + reconciliation)

## User stories addressed

- User story 32
- User story 33
- User story 34
