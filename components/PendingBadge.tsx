'use client'
import { useOfflineQueue } from './OfflineQueueProvider'

export function PendingBadge() {
  const { pendingCount, failedItems } = useOfflineQueue()

  if (pendingCount === 0 && failedItems.length === 0) return null

  return (
    <div className="flex items-center gap-1.5">
      {pendingCount > 0 && (
        <span
          className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-amber-500 text-white text-xs font-medium"
          title={`${pendingCount} action${pendingCount !== 1 ? 's' : ''} pending sync`}
        >
          {pendingCount}
        </span>
      )}
      {failedItems.length > 0 && (
        <span
          className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-red-500 text-white text-xs font-medium"
          title={`${failedItems.length} sync failure${failedItems.length !== 1 ? 's' : ''}`}
        >
          !
        </span>
      )}
    </div>
  )
}
