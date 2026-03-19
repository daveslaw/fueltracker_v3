## Parent PRD

#2

## What to build

Build the OCR Service module for pump meter extraction. Wire Google Cloud Vision into the pump photo capture flow so that after a photo is taken, the app automatically extracts the meter reading and presents it for confirmation. Attendant can accept, correct, or mark as unreadable. This replaces the manual entry from Slice 4 with an auto-extract-then-confirm flow.

## Acceptance criteria

- [ ] OCR Service module wraps Google Cloud Vision API; never called directly from UI
- [ ] After pump photo upload, OCR Service extracts a numeric meter reading
- [ ] Extracted value and confidence score stored on the `pump_readings` row
- [ ] If confidence above threshold: value pre-filled in confirmation input; status set to `auto`
- [ ] If confidence below threshold: input left empty with a "couldn't read clearly — please enter" prompt; status set to `needs_review`
- [ ] Attendant can correct any pre-filled value; on correction status set to `manual_override`
- [ ] Attendant can mark photo as unreadable; status set to `unreadable`; manual numeric entry required
- [ ] OCR failure (API error, timeout) falls back gracefully to manual entry without blocking the flow
- [ ] Unit tests: clean response → correct value; low confidence → needs_review; API error → graceful fallback
- [ ] Google Cloud Vision API key stored in environment variables, never in source code

## Blocked by

- Blocked by #7 (Slice 4: shift open flow)

## User stories addressed

- User story 5
- User story 6
- User story 7
