## Parent PRD

#2

## What to build

Build the Station Config module end-to-end: owner-only admin UI to create stations, add tanks (with grade and capacity), add pumps, and map each pump to a tank. This is the physical configuration layer that all shift data is anchored to. Includes the full DB schema, RLS policies, and admin screens for the three real stations (Elegant Amaglug, Speedway, Truck Stop).

## Acceptance criteria

- [ ] Tables: `stations`, `tanks`, `pumps`, `fuel_grades` created with migrations
- [ ] `pumps.tank_id` FK establishes pump-to-tank mapping
- [ ] RLS: owner can CRUD all; attendants and supervisors can SELECT their station only
- [ ] Admin screen: create/edit station (name, address)
- [ ] Admin screen: add/edit tanks per station (label, fuel grade, capacity in litres)
- [ ] Admin screen: add/edit pumps per station, with tank assignment dropdown
- [ ] Admin screen: update pump-to-tank mapping
- [ ] Fuel grades seeded: 95, 93, D10, D50
- [ ] Seed data for all three real stations, their tanks, and pumps importable via SQL migration
- [ ] Owner can view full station config summary (station → tanks → pumps tree)

## Blocked by

- Blocked by #4 (Slice 1: scaffold + auth)

## User stories addressed

- User story 44
- User story 45
- User story 46
- User story 47
