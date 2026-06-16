'use client'

import { useEffect, useRef } from 'react'

const IDLE_EVENTS = ['mousemove', 'touchstart', 'keydown', 'click'] as const

export function useIdleTimeout(ms: number, onTimeout: () => void): void {
  const onTimeoutRef = useRef(onTimeout)
  onTimeoutRef.current = onTimeout

  useEffect(() => {
    let timer = setTimeout(() => onTimeoutRef.current(), ms)

    function reset() {
      clearTimeout(timer)
      timer = setTimeout(() => onTimeoutRef.current(), ms)
    }

    IDLE_EVENTS.forEach((e) => window.addEventListener(e, reset))
    return () => {
      clearTimeout(timer)
      IDLE_EVENTS.forEach((e) => window.removeEventListener(e, reset))
    }
  }, [ms])
}
