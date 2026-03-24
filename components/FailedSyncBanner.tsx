'use client'
import { useOfflineQueue } from './OfflineQueueProvider'

export function FailedSyncBanner() {
  const { failedItems, retryItem } = useOfflineQueue()
  if (failedItems.length === 0) return null

  return (
    <div className="bg-red-50 border-b border-red-200 px-4 py-2 text-sm text-red-700">
      <div className="max-w-2xl mx-auto flex items-center justify-between gap-3 flex-wrap">
        <span>
          {failedItems.length} offline action{failedItems.length !== 1 ? 's' : ''} failed to sync.
        </span>
        <button
          onClick={() => failedItems.forEach(i => retryItem(i.id))}
          className="text-xs underline font-medium"
        >
          Retry all
        </button>
      </div>
    </div>
  )
}
