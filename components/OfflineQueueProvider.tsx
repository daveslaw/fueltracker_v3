'use client'
import {
  createContext, useContext, useState, useEffect, useCallback, useRef,
} from 'react'
import {
  enqueue, getNextPending, handleItemFailure, getPendingCount, nextBackoffMs,
  MAX_RETRIES,
} from '@/lib/offline-queue'
import type { QueueItem, OfflineAction } from '@/lib/offline-queue'
import { idbGetAll, idbPut, idbDelete } from '@/lib/idb-queue'
import { useToast } from './Toaster'
import { savePumpReading, saveDipReading, saveClosePumpReading, saveCloseDipReading } from '@/app/shift/actions'

interface OfflineQueueContextValue {
  pendingCount: number
  failedItems: QueueItem[]
  addToQueue: (action: OfflineAction, idempotencyKey: string) => Promise<void>
  retryItem: (id: string) => void
}

const OfflineQueueContext = createContext<OfflineQueueContextValue>({
  pendingCount: 0,
  failedItems: [],
  addToQueue: async () => {},
  retryItem: () => {},
})

export function useOfflineQueue() {
  return useContext(OfflineQueueContext)
}

export function OfflineQueueProvider({ children }: { children: React.ReactNode }) {
  const [queue, setQueue] = useState<QueueItem[]>([])
  const { toast } = useToast()
  const syncingRef = useRef(false)

  // Load queue from IndexedDB on mount
  useEffect(() => {
    idbGetAll().then(items => setQueue(items)).catch(() => {})
  }, [])

  // ── Sync engine ──────────────────────────────────────────────────────

  const processItem = useCallback(async (item: QueueItem): Promise<void> => {
    const action = item.action

    if (action.type === 'pump_reading' || action.type === 'dip_reading') {
      let photoUrl: string | undefined

      if (action.type === 'pump_reading' && action.photoBlob) {
        const fd = new FormData()
        fd.append('photo', action.photoBlob, action.photoName ?? 'photo.jpg')
        fd.append('shiftId', action.shiftId)
        const res = await fetch('/api/upload/pump-photo', { method: 'POST', body: fd })
        if (!res.ok) throw new Error('Photo upload failed')
        const json = await res.json()
        photoUrl = json.url
      }

      const fd = new FormData()
      if (action.type === 'pump_reading') {
        fd.append('meterReading', String(action.meterReading))
        fd.append('ocrStatus', action.ocrStatus)
        if (photoUrl) fd.append('photoUrl', photoUrl)
        if (action.readingType === 'open') {
          await savePumpReading(action.shiftId, action.pumpId, fd)
        } else {
          await saveClosePumpReading(action.shiftId, action.pumpId, fd)
        }
      } else {
        fd.append('litres', String(action.litres))
        fd.append('type', action.readingType)
        if (action.readingType === 'open') {
          await saveDipReading(action.shiftId, action.tankId, fd)
        } else {
          await saveCloseDipReading(action.shiftId, action.tankId, fd)
        }
      }

    } else if (action.type === 'pos_submission') {
      let photoUrl: string | undefined
      if (action.photoBlob) {
        const fd = new FormData()
        fd.append('photo', action.photoBlob, 'pos.jpg')
        fd.append('shiftId', action.shiftId)
        const res = await fetch('/api/upload/pos-photo', { method: 'POST', body: fd })
        if (!res.ok) throw new Error('POS photo upload failed')
        const json = await res.json()
        photoUrl = json.url
      }
      const { savePosSubmission } = await import('@/app/shift/actions')
      await savePosSubmission(action.shiftId, photoUrl ?? '', action.rawOcr, action.lines)
    }
  }, [])

  const runSync = useCallback(async (currentQueue: QueueItem[]) => {
    if (syncingRef.current) return
    syncingRef.current = true

    let q = [...currentQueue]

    const next = getNextPending(q)
    if (!next) { syncingRef.current = false; return }

    // Mark as syncing
    const syncing = { ...next, status: 'syncing' as const }
    q = q.map(i => i.id === next.id ? syncing : i)
    await idbPut(syncing)
    setQueue(q)

    try {
      await processItem(next)
      // Success: remove from queue
      await idbDelete(next.id)
      q = q.filter(i => i.id !== next.id)
      setQueue(q)
      toast('Sync successful', 'success')
    } catch (err) {
      const failed = handleItemFailure({ ...next, status: 'pending' }, MAX_RETRIES)
      await idbPut(failed)
      q = q.map(i => i.id === next.id ? failed : i)
      setQueue(q)
      if (failed.status === 'failed') {
        toast('Sync failed — tap to retry in shift history', 'error')
      } else {
        const delay = nextBackoffMs(failed.attemptCount)
        setTimeout(() => {
          setQueue(prev => {
            runSync(prev)
            return prev
          })
        }, delay)
      }
    } finally {
      syncingRef.current = false
    }

    // Continue draining
    setQueue(prev => {
      const hasMore = getNextPending(prev) !== null
      if (hasMore) setTimeout(() => runSync(prev), 0)
      return prev
    })
  }, [processItem, toast])

  // Listen for online event → trigger sync
  useEffect(() => {
    const onOnline = () => {
      setQueue(prev => { runSync(prev); return prev })
    }
    window.addEventListener('online', onOnline)
    // Also attempt sync immediately on mount (handles already-online case with queued items)
    if (navigator.onLine) {
      idbGetAll().then(items => { if (items.length > 0) runSync(items) }).catch(() => {})
    }
    return () => window.removeEventListener('online', onOnline)
  }, [runSync])

  // ── addToQueue ───────────────────────────────────────────────────────

  const addToQueue = useCallback(async (action: OfflineAction, idempotencyKey: string) => {
    const item: QueueItem = {
      id: crypto.randomUUID(),
      idempotencyKey,
      action,
      status: 'pending',
      attemptCount: 0,
      createdAt: Date.now(),
    }
    setQueue(prev => {
      const next = enqueue(prev, item)
      if (next !== prev) idbPut(item).catch(() => {})
      return next
    })
    toast('Saved offline — will sync when connected', 'info')
  }, [toast])

  // ── retryItem ────────────────────────────────────────────────────────

  const retryItem = useCallback((id: string) => {
    setQueue(prev => {
      const item = prev.find(i => i.id === id)
      if (!item) return prev
      const reset = { ...item, status: 'pending' as const, attemptCount: 0 }
      idbPut(reset).then(() => runSync([...prev.filter(i => i.id !== id), reset])).catch(() => {})
      return prev.map(i => i.id === id ? reset : i)
    })
  }, [runSync])

  const pendingCount = getPendingCount(queue)
  const failedItems  = queue.filter(i => i.status === 'failed')

  return (
    <OfflineQueueContext.Provider value={{ pendingCount, failedItems, addToQueue, retryItem }}>
      {children}
    </OfflineQueueContext.Provider>
  )
}
