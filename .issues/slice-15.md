## Parent PRD

#2

## What to build

Build the Offline PWA module. Attendants at stations with unreliable connectivity can capture pump photos, enter meter readings, and record dip readings while offline. Data is queued in IndexedDB. When the device reconnects, the queue drains automatically: photos upload to Supabase Storage first, then readings submit via Server Actions. A pending count badge shows the attendant how many actions are waiting to sync.

## Acceptance criteria

- [ ] Service worker registered and active on all attendant-facing pages
- [ ] All data-entry actions (pump photo capture, meter reading, dip reading, POS submission) can be initiated while offline
- [ ] Photos stored as blobs in IndexedDB alongside their form data while offline
- [ ] Pending action count displayed in app header; updates in real time
- [ ] On reconnect, Offline Queue drains in FIFO order automatically (no manual trigger required)
- [ ] Sync sequence: upload photos to Supabase Storage first → submit readings with returned storage URLs
- [ ] If a sync item fails (e.g. server error), it is retried up to 3 times with exponential backoff, then marked as failed
- [ ] Failed items surfaced to the attendant with a "retry" option
- [ ] Duplicate enqueue of the same action is deduplicated (idempotency key per reading)
- [ ] Conflict rule: if a shift was submitted by another session while offline, the queued submission is rejected and the attendant notified
- [ ] Attendant notified (in-app toast) when a sync succeeds or fails
- [ ] Unit tests: enqueue, FIFO drain, retry up to max, deduplication, pending count accuracy

## Blocked by

- Blocked by #7 (Slice 4: shift open flow)

## User stories addressed

- User story 20
- User story 21
- User story 22
- User story 23
