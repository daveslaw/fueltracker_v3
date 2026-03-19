## Parent PRD

#2

## What to build

Build the shift open flow end-to-end, without OCR (OCR is added in Slice 5). Attendant selects their station and shift period (morning/evening), works through a sequential list of all pumps capturing a photo and entering the meter reading manually, then enters opening dip readings for each tank. Shift is saved as a draft and can be resumed. A progress indicator tracks completion.

This slice delivers a fully demoable shift open submission with real photo uploads to Supabase Storage and real data written to the DB.

## Acceptance criteria

- [ ] Tables: `shifts`, `pump_readings`, `dip_readings` created with migrations and RLS
- [ ] Attendant selects station (pre-filled if user has a station assignment) and shift period
- [ ] System rejects starting a shift if one already exists for that station/period/date in draft or open state
- [ ] Sequential pump list UI: attendant works through pumps one by one
- [ ] Camera capture for each pump (mobile: opens device camera; desktop: file picker)
- [ ] Photo compressed client-side before upload to Supabase Storage
- [ ] Meter reading entered manually (numeric input); OCR status set to `manual_override`
- [ ] Progress indicator: X of Y pumps completed, X of Z tanks completed
- [ ] Dip reading entry screen: one numeric input per tank (litres)
- [ ] Shift saved as draft on every step; attendant can leave and resume
- [ ] Shift transitions to `open` state when all pumps and tanks have readings
- [ ] Attendant sees a summary screen before finalising shift open

## Blocked by

- Blocked by #5 (Slice 2: station config)

## User stories addressed

- User story 2
- User story 3
- User story 4
- User story 7
- User story 8
- User story 9
- User story 10
