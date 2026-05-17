import { describe, it, expect } from 'vitest'
import {
  enqueue,
  getNextPending,
  handleItemFailure,
  getPendingCount,
  nextBackoffMs,
} from '../lib/offline-queue'
import type { QueueItem, OfflineAction } from '../lib/offline-queue'

// --- fixtures ---
let seq = 0
function makeItem(idempotencyKey: string, overrides: Partial<QueueItem> = {}): QueueItem {
  const action: OfflineAction = {
    type: 'dip_reading',
    shiftId: 's1',
    tankId: 't1',
    readingType: 'open',
    litres: 1000,
  }
  return {
    id: `item-${++seq}`,
    idempotencyKey,
    action,
    status: 'pending',
    attemptCount: 0,
    createdAt: Date.now() + seq,  // unique timestamps, ascending
    ...overrides,
  }
}

// ── enqueue ───────────────────────────────────────────────────────────────

describe('enqueue', () => {
  it('adds item to an empty queue', () => {
    const q = enqueue([], makeItem('k1'))
    expect(q).toHaveLength(1)
  })

  it('deduplicates: same idempotencyKey is not added twice', () => {
    const item = makeItem('k1')
    const q = enqueue([item], makeItem('k1'))
    expect(q).toHaveLength(1)
  })

  it('allows multiple items with different idempotency keys', () => {
    const q = enqueue([makeItem('k1')], makeItem('k2'))
    expect(q).toHaveLength(2)
  })
})

// ── getNextPending ────────────────────────────────────────────────────────

describe('getNextPending', () => {
  it('returns the pending item with the lowest createdAt (FIFO)', () => {
    const older = makeItem('k1', { createdAt: 1000 })
    const newer = makeItem('k2', { createdAt: 2000 })
    const result = getNextPending([newer, older])
    expect(result?.idempotencyKey).toBe('k1')
  })

  it('returns null when no pending items exist', () => {
    const q = [makeItem('k1', { status: 'failed' }), makeItem('k2', { status: 'syncing' })]
    expect(getNextPending(q)).toBeNull()
  })

  it('skips failed and syncing items', () => {
    const q = [
      makeItem('k1', { createdAt: 1000, status: 'failed' }),
      makeItem('k2', { createdAt: 2000, status: 'pending' }),
    ]
    const result = getNextPending(q)
    expect(result?.idempotencyKey).toBe('k2')
  })
})

// ── handleItemFailure ─────────────────────────────────────────────────────

describe('handleItemFailure', () => {
  it('increments attemptCount and keeps status pending when under maxRetries', () => {
    const item = makeItem('k1', { attemptCount: 1 })
    const result = handleItemFailure(item, 3)
    expect(result.attemptCount).toBe(2)
    expect(result.status).toBe('pending')
  })

  it('marks status as failed when attemptCount reaches maxRetries', () => {
    const item = makeItem('k1', { attemptCount: 2 })
    const result = handleItemFailure(item, 3)
    expect(result.attemptCount).toBe(3)
    expect(result.status).toBe('failed')
  })
})

// ── getPendingCount ───────────────────────────────────────────────────────

describe('getPendingCount', () => {
  it('counts only items with status pending', () => {
    const q = [
      makeItem('k1', { status: 'pending' }),
      makeItem('k2', { status: 'pending' }),
      makeItem('k3', { status: 'failed' }),
      makeItem('k4', { status: 'syncing' }),
    ]
    expect(getPendingCount(q)).toBe(2)
  })

  it('returns 0 for an empty queue', () => {
    expect(getPendingCount([])).toBe(0)
  })
})

// ── pump_reading payload ──────────────────────────────────────────────────

describe('pump_reading action payload', () => {
  it('preserves maintenanceRequired: true through enqueue and dequeue', () => {
    const action: OfflineAction = {
      type: 'pump_reading',
      shiftId: 's1',
      pumpId: 'p1',
      readingType: 'close',
      meterReading: 12345.67,
      ocrStatus: 'auto',
      maintenanceRequired: true,
    }
    const item: QueueItem = {
      id: 'item-mr',
      idempotencyKey: 'pump_reading:s1:p1:close',
      action,
      status: 'pending',
      attemptCount: 0,
      createdAt: Date.now(),
    }
    const q = enqueue([], item)
    const next = getNextPending(q)
    expect(next?.action).toMatchObject({ type: 'pump_reading', maintenanceRequired: true })
  })

  it('preserves maintenanceRequired: false when not flagged', () => {
    const action: OfflineAction = {
      type: 'pump_reading',
      shiftId: 's1',
      pumpId: 'p2',
      readingType: 'close',
      meterReading: 9999,
      ocrStatus: 'manual_override',
      maintenanceRequired: false,
    }
    const item: QueueItem = {
      id: 'item-mr2',
      idempotencyKey: 'pump_reading:s1:p2:close',
      action,
      status: 'pending',
      attemptCount: 0,
      createdAt: Date.now(),
    }
    const next = getNextPending(enqueue([], item))
    expect(next?.action).toMatchObject({ type: 'pump_reading', maintenanceRequired: false })
  })
})

// ── nextBackoffMs ─────────────────────────────────────────────────────────

describe('nextBackoffMs', () => {
  it('returns 1s for first attempt, doubling each time', () => {
    expect(nextBackoffMs(1)).toBe(1000)
    expect(nextBackoffMs(2)).toBe(2000)
    expect(nextBackoffMs(3)).toBe(4000)
  })
})
