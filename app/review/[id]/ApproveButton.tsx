'use client'

import { useTransition } from 'react'
import { approveShift } from './actions'

export function ApproveButton({ shiftId }: { shiftId: string }) {
  const [pending, start] = useTransition()
  return (
    <button
      onClick={() => start(() => approveShift(shiftId))}
      disabled={pending}
      className="flex-1 bg-green-600 text-white rounded-md py-2.5 text-sm font-medium disabled:opacity-50"
    >
      {pending ? 'Approving…' : 'Approve'}
    </button>
  )
}
