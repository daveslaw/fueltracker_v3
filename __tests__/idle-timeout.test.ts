import { renderHook, act } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { useIdleTimeout } from '@/lib/idle-timeout'

describe('useIdleTimeout', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('tracer bullet: fires callback after configured interval with no activity', () => {
    const onTimeout = vi.fn()
    renderHook(() => useIdleTimeout(10_000, onTimeout))
    act(() => { vi.advanceTimersByTime(10_000) })
    expect(onTimeout).toHaveBeenCalledTimes(1)
  })

  it('does not fire if a mousemove event resets the timer before the interval elapses', () => {
    const onTimeout = vi.fn()
    renderHook(() => useIdleTimeout(10_000, onTimeout))
    act(() => { vi.advanceTimersByTime(5_000) })
    act(() => { window.dispatchEvent(new Event('mousemove')) })
    act(() => { vi.advanceTimersByTime(5_000) })
    expect(onTimeout).not.toHaveBeenCalled()
  })

  it('fires after full interval following a reset event', () => {
    const onTimeout = vi.fn()
    renderHook(() => useIdleTimeout(10_000, onTimeout))
    act(() => { vi.advanceTimersByTime(5_000) })
    act(() => { window.dispatchEvent(new Event('click')) })
    act(() => { vi.advanceTimersByTime(10_000) })
    expect(onTimeout).toHaveBeenCalledTimes(1)
  })

  it('touchstart resets the timer', () => {
    const onTimeout = vi.fn()
    renderHook(() => useIdleTimeout(10_000, onTimeout))
    act(() => { vi.advanceTimersByTime(9_000) })
    act(() => { window.dispatchEvent(new Event('touchstart')) })
    act(() => { vi.advanceTimersByTime(5_000) })
    expect(onTimeout).not.toHaveBeenCalled()
  })

  it('keydown resets the timer', () => {
    const onTimeout = vi.fn()
    renderHook(() => useIdleTimeout(10_000, onTimeout))
    act(() => { vi.advanceTimersByTime(9_000) })
    act(() => { window.dispatchEvent(new Event('keydown')) })
    act(() => { vi.advanceTimersByTime(5_000) })
    expect(onTimeout).not.toHaveBeenCalled()
  })

  it('cleans up event listeners and timer on unmount — callback does not fire', () => {
    const onTimeout = vi.fn()
    const { unmount } = renderHook(() => useIdleTimeout(10_000, onTimeout))
    unmount()
    act(() => { vi.advanceTimersByTime(10_000) })
    expect(onTimeout).not.toHaveBeenCalled()
  })
})
