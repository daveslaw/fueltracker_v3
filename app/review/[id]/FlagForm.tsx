'use client'

import { useState, useTransition } from 'react'
import { flagShift } from './actions'

export function FlagForm({ shiftId }: { shiftId: string }) {
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const fd = new FormData(e.currentTarget)
    start(async () => {
      const result = await flagShift(shiftId, fd)
      if ('error' in result) setError(result.error)
      else setOpen(false)
    })
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex-1 border border-destructive text-destructive rounded-md py-2.5 text-sm font-medium"
      >
        Flag for follow-up
      </button>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2 w-full">
      <textarea
        name="flag_comment"
        required
        rows={3}
        placeholder="Describe the issue…"
        className="w-full border rounded-md px-3 py-2 text-sm"
      />
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="flex-1 border rounded-md py-2 text-sm"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={pending}
          className="flex-1 bg-destructive text-white rounded-md py-2 text-sm font-medium disabled:opacity-50"
        >
          {pending ? 'Saving…' : 'Confirm flag'}
        </button>
      </div>
    </form>
  )
}
