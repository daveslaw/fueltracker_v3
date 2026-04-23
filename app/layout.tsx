import type { Metadata } from 'next'
import { Barlow_Condensed, Outfit, JetBrains_Mono } from 'next/font/google'
import { ServiceWorkerRegistrar } from '@/components/ServiceWorkerRegistrar'
import { ToastProvider } from '@/components/Toaster'
import { OfflineQueueProvider } from '@/components/OfflineQueueProvider'
import { PendingBadge } from '@/components/PendingBadge'
import { FailedSyncBanner } from '@/components/FailedSyncBanner'
import { ThemeProvider } from '@/components/ThemeProvider'
import { ThemeToggle } from '@/components/ThemeToggle'
import './globals.css'

const heading = Barlow_Condensed({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-heading',
})

const ui = Outfit({
  subsets: ['latin'],
  variable: '--font-ui',
})

const code = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-code',
})

export const metadata: Metadata = {
  title: 'FuelTracker',
  description: 'Multi-station fuel inventory tracking',
  manifest: '/manifest.json',
}

const themeScript = `(function(){var t=localStorage.getItem('theme');if(!t)t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';if(t==='dark')document.documentElement.classList.add('dark');})()`

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className={`${heading.variable} ${ui.variable} ${code.variable} font-sans antialiased`}>
        <ThemeProvider>
          <ToastProvider>
            <OfflineQueueProvider>
              <ServiceWorkerRegistrar />
              <div className="fixed top-3 right-3 z-40 flex items-center gap-2">
                <ThemeToggle />
                <PendingBadge />
              </div>
              <FailedSyncBanner />
              {children}
            </OfflineQueueProvider>
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
