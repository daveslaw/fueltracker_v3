import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getDeliveryReport } from '@/lib/delivery-report'
import { DeliveriesTable } from './DeliveriesTable'
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbPage, BreadcrumbSeparator } from '@/components/ui/breadcrumb'

interface Props {
  searchParams: Promise<{
    from?: string
    to?: string
    station?: string
    page?: string
  }>
}

function fmtL(n: number) {
  return n.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' L'
}

export default async function DeliveriesReportPage({ searchParams }: Props) {
  const params = await searchParams

  const today = new Date()
  const defaultFrom = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10)
  const defaultTo = today.toISOString().slice(0, 10)

  const fromDate = params.from ?? defaultFrom
  const toDate = params.to ?? defaultTo
  const stationFilter = params.station && params.station !== 'all' ? params.station : undefined
  const page = Math.max(1, parseInt(params.page ?? '1', 10))
  const pageSize = 30

  const supabase = await createClient()
  const { data: stations } = await supabase.from('stations').select('id, name').order('name')

  const report = await getDeliveryReport(supabase as any, {
    stationId: stationFilter,
    fromDate,
    toDate,
    page,
    pageSize,
  })

  const showStationSubtotals = !stationFilter && Object.keys(report.stationSubtotals).length > 1

  const buildUrl = (overrides: Record<string, string>) => {
    const p = new URLSearchParams({
      from: fromDate, to: toDate,
      station: params.station ?? 'all',
      page: String(page),
      ...overrides,
    })
    return `/dashboard/reports/deliveries?${p}`
  }

  return (
    <main className="max-w-5xl mx-auto p-4 space-y-5">
      <Breadcrumb>
        <BreadcrumbItem><BreadcrumbLink href="/dashboard">Dashboard</BreadcrumbLink></BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem><BreadcrumbLink href="/dashboard/reports">Reports</BreadcrumbLink></BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem><BreadcrumbPage>Deliveries</BreadcrumbPage></BreadcrumbItem>
      </Breadcrumb>
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold mt-1">Deliveries Report</h1>
      </div>

      {/* Filter form */}
      <form method="GET" action="/dashboard/reports/deliveries" className="flex flex-wrap gap-3 items-end">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">From</label>
          <input
            type="date" name="from"
            defaultValue={fromDate} max={defaultTo}
            className="border rounded px-2 py-1.5 text-sm"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">To</label>
          <input
            type="date" name="to"
            defaultValue={toDate} max={defaultTo}
            className="border rounded px-2 py-1.5 text-sm"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">Station</label>
          <select name="station" defaultValue={params.station ?? 'all'} className="border rounded px-2 py-1.5 text-sm">
            <option value="all">All stations</option>
            {(stations ?? []).map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
        <button type="submit" className="rounded bg-black px-4 py-1.5 text-sm text-white">View</button>
        <a
          href={`/dashboard/reports/deliveries/export?from=${fromDate}&to=${toDate}&station=${params.station ?? 'all'}`}
          className="rounded border px-4 py-1.5 text-sm"
        >
          Export CSV
        </a>
      </form>

      {/* Summary cards */}
      <div className="flex gap-4">
        <div className="border rounded-lg px-5 py-3 text-center min-w-24">
          <div className="text-2xl font-bold">{report.totalCount}</div>
          <div className="text-xs text-muted-foreground mt-0.5">Deliveries</div>
        </div>
        <div className="border rounded-lg px-5 py-3 text-center">
          <div className="text-2xl font-bold">{fmtL(report.totalLitres)}</div>
          <div className="text-xs text-muted-foreground mt-0.5">Total litres received</div>
        </div>
      </div>

      {/* Table */}
      {report.totalCount === 0 ? (
        <p className="text-sm text-muted-foreground">No deliveries found for the selected period.</p>
      ) : (
        <DeliveriesTable
          rows={report.rows}
          totalLitres={report.totalLitres}
          stationSubtotals={report.stationSubtotals}
          showStationSubtotals={showStationSubtotals}
        />
      )}

      {/* Pagination */}
      {report.totalPages > 1 && (
        <div className="flex items-center gap-3 text-sm">
          {page > 1 ? (
            <Link href={buildUrl({ page: String(page - 1) })} className="text-blue-600 hover:underline">← Previous</Link>
          ) : (
            <span className="text-muted-foreground">← Previous</span>
          )}
          <span className="text-muted-foreground">Page {page} of {report.totalPages}</span>
          {page < report.totalPages ? (
            <Link href={buildUrl({ page: String(page + 1) })} className="text-blue-600 hover:underline">Next →</Link>
          ) : (
            <span className="text-muted-foreground">Next →</span>
          )}
        </div>
      )}
    </main>
  )
}
