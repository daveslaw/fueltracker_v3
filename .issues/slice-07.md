## Parent PRD

#2

## What to build

Build the POS Z-report capture module. Attendant photographs the end-of-shift Z-report printout. Google Cloud Vision extracts structured sales lines (fuel grade, litres sold, revenue in ZAR). Attendant reviews and confirms each line, or corrects OCR errors. If the photo is unreadable, attendant enters all values manually. On confirmation, the shift is ready for submission.

## Acceptance criteria

- [ ] Tables: `pos_submissions`, `pos_submission_lines` created with migrations and RLS
- [ ] One POS submission allowed per shift
- [ ] Attendant photographs Z-report; photo uploaded to Supabase Storage
- [ ] OCR Service `extractPOSReport` call: extracts array of `{grade, litres_sold, revenue}` lines
- [ ] Extracted lines displayed for confirmation; each line individually editable
- [ ] Grades in extracted lines matched to known fuel grades (95, 93, D10, D50); unmatched grades flagged
- [ ] Attendant can add a missing grade line manually
- [ ] Attendant can mark the Z-report photo as unreadable; full manual entry mode activated
- [ ] Confirmed sales lines stored on `pos_submission_lines` with `ocr_status` (auto / manual_override / unreadable)
- [ ] Raw OCR JSON from Google Vision stored on `pos_submissions` for audit purposes
- [ ] Unit tests: clean Z-report response → correct structured lines; partial extraction → partial result + flags; empty response → empty array, no error

## Blocked by

- Blocked by #8 (Slice 5: OCR pump meter)

## User stories addressed

- User story 14
- User story 15
- User story 16
- User story 17
