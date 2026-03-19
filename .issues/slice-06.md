## Parent PRD

#2

## What to build

Build the shift close flow for pump meter readings and tank dip readings. Mirrors the shift open flow (Slice 4) but captures closing values. Uses OCR from Slice 5 for pump meter extraction. After closing readings are saved, the shift is ready for POS submission (Slice 7).

## Acceptance criteria

- [ ] Attendant can initiate shift close only after shift open is in `open` state
- [ ] Sequential pump list for closing meter readings: same flow as open (photo → OCR → confirm)
- [ ] Closing dip reading entry for each tank (litres)
- [ ] Closing pump readings and dip readings stored with `type = 'close'` on existing `pump_readings` and `dip_readings` tables
- [ ] Progress indicator tracks closing pump and tank completion separately from opening
- [ ] Cannot submit shift close without all closing pump readings and dip readings present
- [ ] After all closing readings saved, shift status moves to `pending_pos` (awaiting POS Z-report)
- [ ] Attendant sees summary of open vs close meter readings per pump before proceeding to POS step

## Blocked by

- Blocked by #7 (Slice 4: shift open flow)
- Blocked by #8 (Slice 5: OCR pump meter)

## User stories addressed

- User story 11
- User story 12
- User story 13
