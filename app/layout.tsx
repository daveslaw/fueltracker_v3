import type { Metadata } from 'next'
import { Geist } from 'next/font/google'
import { ServiceWorkerRegistrar } from '@/components/ServiceWorkerRegistrar'
import { ToastProvider } from '@/components/Toaster'
import { OfflineQueueProvider } from '@/components/OfflineQueueProvider'
import { PendingBadge } from '@/components/PendingBadge'
import { FailedSyncBanner } from '@/components/FailedSyncBanner'
import './globals.css'

const geist = Geist({ subsets: ['latin'], variable: '--font-geist' })

export const metadata: Metadata = {
  title: 'FuelTracker',
  description: 'Multi-station fuel inventory tracking',
  manifest: '/manifest.json',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${geist.variable} font-sans antialiased`}>
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
