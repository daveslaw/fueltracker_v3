'use client'

import { useState } from 'react'

type Props = {
  userName: string
  onSubmit: (pin: string) => Promise<void>
  onBack: () => void
}

const DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'] as const

export function PinPad({ userName, onSubmit, onBack }: Props) {
  const [digits, setDigits] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [attemptsRemaining, setAttemptsRemaining] = useState<number | null>(null)
  const [pending, setPending] = useState(false)

  async function handleDigit(d: string) {
    if (d === '⌫') {
      setDigits((prev) => prev.slice(0, -1))
      return
    }
    if (d === '') return
    if (digits.length >= 4) return

    const next = [...digits, d]
    setDigits(next)

    if (next.length === 4) {
      setPending(true)
      setError(null)
      try {
        await onSubmit(next.join(''))
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Something went wrong'
        setError(msg)
      } finally {
        setDigits([])
        setPending(false)
      }
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  function handleError(msg: string, remaining: number | null) {
    setError(msg)
    setAttemptsRemaining(remaining)
  }

  return (
    <div className="flex flex-col items-center gap-6 w-full max-w-xs">
      <div className="text-center">
        <p className="text-sm text-gray-400 mb-1">Signing in as</p>
        <p className="text-lg font-semibold text-gray-900">{userName}</p>
      </div>

      {/* PIN dots */}
      <div className="flex gap-4">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={`w-4 h-4 rounded-full border-2 transition-colors ${
              digits.length > i
                ? 'bg-amber-400 border-amber-400'
                : 'bg-transparent border-gray-300'
            }`}
          />
        ))}
      </div>

      {/* Error / lockout message */}
      {error && (
        <div className="w-full rounded-lg px-4 py-2.5 text-sm text-center bg-red-50 border border-red-200 text-red-700">
          {error}
          {attemptsRemaining !== null && attemptsRemaining > 0 && (
            <span className="block text-xs mt-0.5">{attemptsRemaining} attempts remaining</span>
          )}
        </div>
      )}

      {/* Keypad */}
      <div className="grid grid-cols-3 gap-3 w-full">
        {DIGITS.map((d, i) => (
          <button
            key={i}
            disabled={pending || d === '' || (digits.length >= 4 && d !== '⌫')}
            onClick={() => handleDigit(d)}
            className={`h-16 rounded-xl text-xl font-semibold transition-colors ${
              d === ''
                ? 'invisible'
                : 'bg-white border border-gray-200 text-gray-900 hover:bg-gray-50 hover:border-gray-300 active:bg-gray-100 disabled:opacity-40 shadow-sm'
            }`}
          >
            {d}
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={onBack}
        className="text-sm text-gray-400 hover:text-gray-600"
      >
        Back
      </button>
    </div>
  )
}
