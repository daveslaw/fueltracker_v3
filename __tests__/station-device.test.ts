import { describe, it, expect, beforeEach } from 'vitest'
import { getStationId, setStationId } from '@/lib/station-device'

beforeEach(() => {
  localStorage.clear()
})

describe('getStationId', () => {
  it('tracer bullet: returns null when nothing is set', () => {
    expect(getStationId()).toBeNull()
  })

  it('returns the value written by setStationId', () => {
    setStationId('station-uuid-123')
    expect(getStationId()).toBe('station-uuid-123')
  })

  it('returns null when localStorage throws', () => {
    const original = Object.getOwnPropertyDescriptor(window, 'localStorage')!
    Object.defineProperty(window, 'localStorage', {
      get() { throw new Error('unavailable') },
      configurable: true,
    })
    expect(getStationId()).toBeNull()
    Object.defineProperty(window, 'localStorage', original)
  })
})

describe('setStationId', () => {
  it('is a silent no-op when localStorage throws', () => {
    const original = Object.getOwnPropertyDescriptor(window, 'localStorage')!
    Object.defineProperty(window, 'localStorage', {
      get() { throw new Error('unavailable') },
      configurable: true,
    })
    expect(() => setStationId('any-id')).not.toThrow()
    Object.defineProperty(window, 'localStorage', original)
  })
})
