import type { Metadata } from 'next'
import { Geist } from 'next/font/google'
import { ServiceWorkerRegistrar } from '@/components/ServiceWorkerRegistrar'
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
          <ServiceWorkerRegistrar />
          {children}
        </body>
    </html>
  )
}
