import type { Metadata } from 'next'
import { Barlow_Condensed, Outfit, JetBrains_Mono } from 'next/font/google'
import { ServiceWorkerRegistrar } from '@/components/ServiceWorkerRegistrar'
import { ToastProvider } from '@/components/Toaster'
import { OfflineQueueProvider } from '@/components/OfflineQueueProvider'
import { PendingBadge } from '@/components/PendingBadge'
import { FailedSyncBanner } from '@/components/FailedSyncBanner'
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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${heading.variable} ${ui.variable} ${code.variable} font-sans antialiased`}>
        <ToastProvider>
          <OfflineQueueProvider>
            <ServiceWorkerRegistrar />
            {/* Pending sync badge — fixed top-right, visible on attendant pages */}
            <div className="fixed top-3 right-3 z-40">
              <PendingBadge />
            </div>
            <FailedSyncBanner />
            {children}
          </OfflineQueueProvider>
        </ToastProvider>
      </body>
    </html>
  )
}
