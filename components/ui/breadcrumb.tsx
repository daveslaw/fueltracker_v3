import * as React from 'react'
import Link from 'next/link'

export function Breadcrumb({ children }: { children: React.ReactNode }) {
  return (
    <nav aria-label="Breadcrumb">
      <ol className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
        {children}
      </ol>
    </nav>
  )
}

export function BreadcrumbItem({ children }: { children: React.ReactNode }) {
  return <li className="flex items-center gap-1.5">{children}</li>
}

export function BreadcrumbLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="hover:text-foreground transition-colors">
      {children}
    </Link>
  )
}

export function BreadcrumbPage({ children }: { children: React.ReactNode }) {
  return (
    <span aria-current="page" className="text-foreground font-medium">
      {children}
    </span>
  )
}

export function BreadcrumbSeparator() {
  return <span aria-hidden="true">/</span>
}
