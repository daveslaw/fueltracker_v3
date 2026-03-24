export interface TankTrendPoint {
  date: string
  litres: number | null
}

export interface TankTrendSeries {
  tankId: string
  tankLabel: string
  capacityLitres: number
  points: TankTrendPoint[]
}

export interface DeliveryMarker {
  date: string
  tankId: string
  litresReceived: number
}

// ── buildTankTrendSeries ──────────────────────────────────────────────────

export function buildTankTrendSeries(
  closingDips: { tank_id: string; shift_date: string; litres: number }[],
  tanks: { id: string; label: string; capacity_litres: number }[],
  startDate: string,
  endDate: string,
): TankTrendSeries[] {
  // Generate all dates in [startDate, endDate]
  const dates: string[] = []
  const d = new Date(startDate + 'T00:00:00Z')
  const end = new Date(endDate + 'T00:00:00Z')
  while (d <= end) {
    dates.push(d.toISOString().slice(0, 10))
    d.setUTCDate(d.getUTCDate() + 1)
  }

  const dipMap = new Map<string, number>()
  for (const dip of closingDips) {
    dipMap.set(`${dip.tank_id}:${dip.shift_date}`, dip.litres)
  }

  return tanks.map(t => ({
    tankId: t.id,
    tankLabel: t.label,
    capacityLitres: t.capacity_litres,
    points: dates.map(date => ({
      date,
      litres: dipMap.get(`${t.id}:${date}`) ?? null,
    })),
  }))
}

// ── applyDateRangePreset ──────────────────────────────────────────────────

export function applyDateRangePreset(
  preset: '7d' | '30d' | 'custom',
  today: string,
  from?: string,
  to?: string,
): { from: string; to: string } {
  if (preset === 'custom') return { from: from ?? today, to: to ?? today }
  const days = preset === '7d' ? 6 : 29
  const d = new Date(today + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() - days)
  return { from: d.toISOString().slice(0, 10), to: today }
}

// ── buildDeliveryMarkers ──────────────────────────────────────────────────

export function buildDeliveryMarkers(
  deliveries: { tank_id: string; litres_received: number; delivered_at: string }[],
  startDate: string,
  endDate: string,
): DeliveryMarker[] {
  return deliveries
    .filter(d => {
      const date = d.delivered_at.slice(0, 10)
      return date >= startDate && date <= endDate
    })
    .map(d => ({
      date: d.delivered_at.slice(0, 10),
      tankId: d.tank_id,
      litresReceived: d.litres_received,
    }))
    .sort((a, b) => a.date.localeCompare(b.date))
}
