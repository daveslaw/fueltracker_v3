'use client'

import { useState, useTransition } from 'react'
import { createOverride } from './actions'

interface Props {
  shiftId:      string
  readingId:    string
  readingType:  'pump' | 'pos_line'
  currentValue: number
  label:        string
}

export function OverrideForm({ shiftId, readingId, readingType, currentValue, label }: Props) {
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const fd = new FormData(e.currentTarget)
    start(async () => {
      const result = await createOverride(shiftId, fd)
      if ('error' in result) setError(result.error)
      else setOpen(false)
    })
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-xs text-muted-foreground underline"
      >
        Override
      </button>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="mt-2 space-y-2 border rounded-md p-3 bg-muted/30">
      <input type="hidden" name="reading_id"     value={readingId} />
      <input type="hidden" name="reading_type"   value={readingType} />
      <input type="hidden" name="original_value" value={currentValue} />
      <p className="text-xs font-medium">{label}</p>
      <input
        name="override_value"
        type="number"
        step="0.01"
        min="0"
        defaultValue={currentValue}
        required
        className="w-full border rounded-md px-2 py-1 text-sm"
      />
      <input
        name="reason"
        type="text"
        required
        placeholder="Reason for override"
        className="w-full border rounded-md px-2 py-1 text-sm"
      />
      {error && <p className="text-xs text-destructive">{error}</p>}
      <div className="flex gap-2">
        <button type="button" onClick={() => setOpen(false)} className="text-xs underline">Cancel</button>
        <button
          type="submit"
          disabled={pending}
          className="text-xs bg-primary text-primary-foreground px-3 py-1 rounded-md disabled:opacity-50"
        >
          {pending ? 'Saving…' : 'Save override'}
        </button>
      </div>
    </form>
  )
}
