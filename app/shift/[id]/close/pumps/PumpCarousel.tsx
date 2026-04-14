'use client'

import { useState } from 'react'
import { ClosePumpCaptureForm } from './ClosePumpCaptureForm'

type Pump = { id: string; label: string; defaultMeter: string }

type Props = {
  shiftId: string
  pumps: Pump[]
  initialSavedIds: string[]
}

export function PumpCarousel({ shiftId, pumps, initialSavedIds }: Props) {
  const [currentIndex, setCurrentIndex] = useState(() => {
    // Start on the first unsaved pump, or 0 if all done
    const first = pumps.findIndex(p => !initialSavedIds.includes(p.id))
    return first === -1 ? 0 : first
  })
  const [savedIds, setSavedIds] = useState<string[]>(initialSavedIds)

  const pump = pumps[currentIndex]
  const total = pumps.length
  const doneCount = savedIds.length

  function markSaved(pumpId: string) {
    setSavedIds(prev => prev.includes(pumpId) ? prev : [...prev, pumpId])
  }

  function handleSaved() {
    markSaved(pump.id)
    // Advance to next unsaved pump
    const next = pumps.findIndex((p, i) => i > currentIndex && !savedIds.includes(p.id) && p.id !== pump.id)
    if (next !== -1) setCurrentIndex(next)
  }

  function goTo(index: number) {
    if (index >= 0 && index < total) setCurrentIndex(index)
  }

  const isSaved = savedIds.includes(pump.id)

  return (
    <div className="space-y-6">
      {/* Progress bar */}
      <div className="space-y-1">
        <div className="flex justify-between text-xs text-gray-500">
          <span>{pump.label}</span>
          <span>{doneCount}/{total} saved</span>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-1.5">
          <div
            className="bg-black h-1.5 rounded-full transition-all"
            style={{ width: `${(doneCount / total) * 100}%` }}
          />
        </div>
      </div>

      {/* Pump card */}
      <div className="rounded-lg border p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="font-medium text-lg" data-testid="current-pump-label">{pump.label}</span>
          {isSaved && (
            <span className="text-xs text-green-600 font-medium">Saved</span>
          )}
        </div>
        <ClosePumpCaptureForm
          key={pump.id}
          shiftId={shiftId}
          pumpId={pump.id}
          defaultMeter={pump.defaultMeter}
          onSaved={handleSaved}
        />
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between gap-3">
        <button
          onClick={() => goTo(currentIndex - 1)}
          disabled={currentIndex === 0}
          className="flex-1 rounded border py-2 text-sm font-medium disabled:opacity-30 cursor-pointer disabled:cursor-default"
        >
          Previous
        </button>

        {/* Dot indicators */}
        <div className="flex gap-1 flex-wrap justify-center max-w-[160px]">
          {pumps.map((p, i) => (
            <button
              key={p.id}
              onClick={() => goTo(i)}
              className={`w-2 h-2 rounded-full transition-colors cursor-pointer ${
                i === currentIndex
                  ? 'bg-black'
                  : savedIds.includes(p.id)
                  ? 'bg-green-400'
                  : 'bg-gray-200'
              }`}
              title={p.label}
            />
          ))}
        </div>

        <button
          onClick={() => goTo(currentIndex + 1)}
          disabled={currentIndex === total - 1}
          className="flex-1 rounded border py-2 text-sm font-medium disabled:opacity-30 cursor-pointer disabled:cursor-default"
        >
          Next
        </button>
      </div>
    </div>
  )
}
