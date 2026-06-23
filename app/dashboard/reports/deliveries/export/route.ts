import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getDeliveryReport } from '@/lib/delivery-report'
import type { DeliveryDb } from '@/lib/delivery-report'
import { formatDeliveriesCSV, buildCsvFilename } from '@/lib/csv-export'

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl

  const today = new Date()
  const defaultFrom = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10)
  const defaultTo = today.toISOString().slice(0, 10)

  const fromDate = searchParams.get('from') ?? defaultFrom
  const toDate = searchParams.get('to') ?? defaultTo
  const stationParam = searchParams.get('station')
  const stationId = stationParam && stationParam !== 'all' ? stationParam : undefined

  const supabase = await createClient()

  let stationName = 'all_stations'
  if (stationId) {
    const { data } = await supabase.from('stations').select('name').eq('id', stationId).single()
    if (data?.name) stationName = data.name
  }

  const report = await getDeliveryReport(supabase as unknown as DeliveryDb, {
    stationId,
    fromDate,
    toDate,
    page: 1,
    pageSize: 100_000,
  })

  const csv = formatDeliveriesCSV(report.rows)
  const filename = buildCsvFilename('deliveries', stationName, `${fromDate}_${toDate}`)

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
