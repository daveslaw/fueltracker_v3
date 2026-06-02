'use client'

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
} from 'react'
import { usePathname } from 'next/navigation'
import type { FeedbackError } from '@/lib/feedback'

const MAX_ERRORS = 10
const MAX_BREADCRUMBS = 5

interface FeedbackContextValue {
  recentErrors: FeedbackError[]
  routeBreadcrumbs: string[]
}

const FeedbackContext = createContext<FeedbackContextValue>({
  recentErrors: [],
  routeBreadcrumbs: [],
})

export function useFeedback() {
  return useContext(FeedbackContext)
}

export function FeedbackProvider({ children }: { children: React.ReactNode }) {
  const [recentErrors, setRecentErrors] = useState<FeedbackError[]>([])
  const [routeBreadcrumbs, setRouteBreadcrumbs] = useState<string[]>([])
  const pathname = usePathname()
  const originalConsoleError = useRef<typeof console.error | null>(null)

  const addError = useCallback((message: string) => {
    setRecentErrors(prev => {
      const entry: FeedbackError = { message, timestamp: Date.now() }
      const next = [...prev, entry]
      return next.length > MAX_ERRORS ? next.slice(next.length - MAX_ERRORS) : next
    })
  }, [])

  // Track route changes
  useEffect(() => {
    setRouteBreadcrumbs(prev => {
      const next = [...prev, pathname]
      return next.length > MAX_BREADCRUMBS ? next.slice(next.length - MAX_BREADCRUMBS) : next
    })
  }, [pathname])

  // Intercept global errors and unhandled promise rejections
  useEffect(() => {
    const onError = (event: ErrorEvent) => {
      addError(event.message || 'Unknown error')
    }
    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      addError(String(event.reason) || 'Unhandled promise rejection')
    }
    window.addEventListener('error', onError)
    window.addEventListener('unhandledrejection', onUnhandledRejection)
    return () => {
      window.removeEventListener('error', onError)
      window.removeEventListener('unhandledrejection', onUnhandledRejection)
    }
  }, [addError])

  // Intercept console.error
  useEffect(() => {
    originalConsoleError.current = console.error
    console.error = (...args: unknown[]) => {
      addError(args.map(a => String(a)).join(' '))
      originalConsoleError.current?.(...args)
    }
    return () => {
      if (originalConsoleError.current) {
        console.error = originalConsoleError.current
      }
    }
  }, [addError])

  return (
    <FeedbackContext.Provider value={{ recentErrors, routeBreadcrumbs }}>
      {children}
    </FeedbackContext.Provider>
  )
}
