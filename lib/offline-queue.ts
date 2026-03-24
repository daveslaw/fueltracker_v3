export type QueueItemStatus = 'pending' | 'syncing' | 'failed'

export type OfflineAction =
  | { type: 'pump_reading'; shiftId: string; pumpId: string; readingType: 'open' | 'close'; meterReading: number; ocrStatus: string; photoBlob?: Blob; photoName?: string }
  | { type: 'dip_reading'; shiftId: string; tankId: string; readingType: 'open' | 'close'; litres: number }
  | { type: 'pos_submission'; shiftId: string; rawOcr: string; lines: { fuel_grade_id: string; litres_sold: number; revenue_zar: number }[]; photoBlob?: Blob }

export interface QueueItem {
  id: string
  idempotencyKey: string   // format: "{type}:{shiftId}:{entityId}:{readingType}"
  action: OfflineAction
  status: QueueItemStatus
  attemptCount: number
  createdAt: number        // epoch ms — used for FIFO ordering
  failureReason?: string
}

export const MAX_RETRIES = 3

// ── enqueue ───────────────────────────────────────────────────────────────

/** Adds item to queue. No-ops if an item with the same idempotencyKey already exists. */
export function enqueue(queue: QueueItem[], item: QueueItem): QueueItem[] {
  if (queue.some(q => q.idempotencyKey === item.idempotencyKey)) return queue
  return [...queue, item]
}

// ── getNextPending ────────────────────────────────────────────────────────

/** Returns the pending item with the lowest createdAt (FIFO), or null if none. */
export function getNextPending(queue: QueueItem[]): QueueItem | null {
  const pending = queue.filter(q => q.status === 'pending')
  if (pending.length === 0) return null
  return pending.reduce((min, cur) => cur.createdAt < min.createdAt ? cur : min)
}

// ── handleItemFailure ─────────────────────────────────────────────────────

/** Increments attemptCount. Marks as 'failed' when maxRetries is reached. */
export function handleItemFailure(item: QueueItem, maxRetries = MAX_RETRIES): QueueItem {
  const attemptCount = item.attemptCount + 1
  return {
    ...item,
    attemptCount,
    status: attemptCount >= maxRetries ? 'failed' : 'pending',
  }
}

// ── getPendingCount ───────────────────────────────────────────────────────

export function getPendingCount(queue: QueueItem[]): number {
  return queue.filter(q => q.status === 'pending').length
}

// ── nextBackoffMs ─────────────────────────────────────────────────────────

/** Exponential backoff: attempt 1 → 1s, 2 → 2s, 3 → 4s, … */
export function nextBackoffMs(attempt: number): number {
  return 1000 * Math.pow(2, attempt - 1)
}
