export type DeliveryReportRow = {
  id: string
  deliveredAt: string
  stationId: string
  stationName: string
  tankLabel: string
  fuelGrade: string
  litresReceived: number
  deliveryNoteNumber: string
  driverName: string
  recordedByName: string
  deliveryNoteUrl: string | null
}

export type DeliveryReportResult = {
  rows: DeliveryReportRow[]
  totalCount: number
  totalLitres: number
  totalPages: number
  stationSubtotals: Record<string, { stationName: string; litres: number }>
}

export type DeliveryReportParams = {
  stationId?: string
  fromDate: string
  toDate: string
  page: number
  pageSize: number
}

export type RawDeliveryRow = {
  id: string
  litres_received: number
  delivery_note_number: string
  driver_name: string | null
  delivery_note_url: string | null
  delivered_at: string
  station_id: string
  stations: { id: string; name: string } | null
  tanks: { id: string; label: string; fuel_grade_id: string } | null
  user_profiles: { email: string } | null
}

interface DeliveryQueryBuilder {
  eq(column: string, value: string): DeliveryQueryBuilder
  gte(column: string, value: string): DeliveryQueryBuilder
  lte(column: string, value: string): DeliveryQueryBuilder
  order(
    column: string,
    opts: { ascending: boolean },
  ): PromiseLike<{ data: RawDeliveryRow[] | null; error: { message?: string } | null }>
}

export interface DeliveryDb {
  from(table: string): { select(query: string): DeliveryQueryBuilder }
}

export async function getDeliveryReport(
  db: DeliveryDb,
  params: DeliveryReportParams,
): Promise<DeliveryReportResult> {
  const { stationId, fromDate, toDate, page, pageSize } = params

  let query = db
    .from('deliveries')
    .select(`
      id,
      litres_received,
      delivery_note_number,
      driver_name,
      delivery_note_url,
      delivered_at,
      station_id,
      stations ( id, name ),
      tanks ( id, label, fuel_grade_id ),
      user_profiles ( email )
    `)
    .gte('delivered_at', `${fromDate}T00:00:00Z`)
    .lte('delivered_at', `${toDate}T23:59:59.999Z`)

  if (stationId) {
    query = query.eq('station_id', stationId)
  }

  const { data, error } = await query.order('delivered_at', { ascending: false })

  if (error) throw new Error(error.message ?? 'Failed to fetch deliveries')

  const all: DeliveryReportRow[] = (data ?? []).map((r) => ({
    id: r.id,
    deliveredAt: r.delivered_at,
    stationId: r.station_id,
    stationName: r.stations?.name ?? '',
    tankLabel: r.tanks?.label ?? '',
    fuelGrade: r.tanks?.fuel_grade_id ?? '',
    litresReceived: Number(r.litres_received),
    deliveryNoteNumber: r.delivery_note_number,
    driverName: r.driver_name ?? '—',
    recordedByName: r.user_profiles?.email ?? '',
    deliveryNoteUrl: r.delivery_note_url ?? null,
  }))

  const totalCount = all.length
  const totalLitres = all.reduce((sum, r) => sum + r.litresReceived, 0)
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))

  const stationSubtotals: Record<string, { stationName: string; litres: number }> = {}
  for (const r of all) {
    if (!stationSubtotals[r.stationId]) {
      stationSubtotals[r.stationId] = { stationName: r.stationName, litres: 0 }
    }
    stationSubtotals[r.stationId].litres += r.litresReceived
  }

  const start = (page - 1) * pageSize
  const rows = all.slice(start, start + pageSize)

  return { rows, totalCount, totalLitres, totalPages, stationSubtotals }
}
