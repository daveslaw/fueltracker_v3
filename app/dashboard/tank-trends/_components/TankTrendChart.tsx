'use client'
import { useState } from 'react'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from 'recharts'
import type { TankTrendSeries, DeliveryMarker } from '@/lib/tank-trends'

const COLOURS = ['#2563eb', '#16a34a', '#dc2626', '#d97706', '#7c3aed', '#0891b2', '#db2777']

interface Props {
  series: TankTrendSeries[]
  deliveries: DeliveryMarker[]
}

export function TankTrendChart({ series, deliveries }: Props) {
  const [hidden, setHidden] = useState<Set<string>>(new Set())

  const toggle = (tankId: string) =>
    setHidden(prev => {
      const next = new Set(prev)
      next.has(tankId) ? next.delete(tankId) : next.add(tankId)
      return next
    })

  if (series.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-sm text-muted-foreground border rounded-md">
        No dip readings for this date range.
      </div>
    )
  }

  // Flat recharts data: one entry per date
  const dates = series[0].points.map(p => p.date)
  const data = dates.map((date, i) => {
    const entry: Record<string, string | number | null> = { date }
    for (const s of series) {
      if (!hidden.has(s.tankId)) entry[s.tankId] = s.points[i].litres
    }
    return entry
  })

  const fmtDate = (d: string) =>
    new Date(d + 'T00:00:00Z').toLocaleDateString('en-GB', {
      day: '2-digit', month: '2-digit', timeZone: 'UTC',
    })

  const fmtL = (v: number) => v.toLocaleString('en-ZA') + ' L'

  const deliveryDates = new Set(deliveries.map(d => d.date))

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null
    const dateDeliveries = deliveries.filter(d => d.date === label)
    return (
      <div className="bg-white border rounded shadow-sm p-3 text-xs space-y-1 min-w-[140px]">
        <div className="font-medium">{label}</div>
        {payload.map((p: any) => (
          <div key={p.dataKey} style={{ color: p.color }}>
            {series.find(s => s.tankId === p.dataKey)?.tankLabel ?? p.dataKey}:{' '}
            {p.value != null ? fmtL(p.value) : '—'}
          </div>
        ))}
        {dateDeliveries.length > 0 && (
          <div className="border-t pt-1 mt-1 text-amber-700 font-medium">
            {dateDeliveries.map((d, i) => (
              <div key={i}>
                Delivery: {series.find(s => s.tankId === d.tankId)?.tankLabel ?? d.tankId}{' '}
                +{fmtL(d.litresReceived)}
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  const visible = series.filter(s => !hidden.has(s.tankId))

  return (
    <div className="space-y-3">
      {/* Legend / toggle buttons */}
      <div className="flex flex-wrap gap-2">
        {series.map((s, i) => (
          <button
            key={s.tankId}
            onClick={() => toggle(s.tankId)}
            className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded border transition-opacity ${
              hidden.has(s.tankId) ? 'opacity-35' : ''
            }`}
          >
            <span
              className="inline-block w-4 h-0.5 rounded"
              style={{ background: COLOURS[i % COLOURS.length] }}
            />
            {s.tankLabel}
          </button>
        ))}
      </div>

      <ResponsiveContainer width="100%" height={350}>
        <LineChart data={data} margin={{ top: 8, right: 20, bottom: 8, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis
            dataKey="date"
            tickFormatter={fmtDate}
            tick={{ fontSize: 11 }}
            interval="preserveStartEnd"
          />
          <YAxis
            tickFormatter={v => v.toLocaleString('en-ZA')}
            tick={{ fontSize: 11 }}
            width={72}
          />
          <Tooltip content={<CustomTooltip />} />

          {/* Capacity reference lines (dashed, per tank) */}
          {visible.map((s, i) => (
            <ReferenceLine
              key={`cap-${s.tankId}`}
              y={s.capacityLitres}
              stroke={COLOURS[i % COLOURS.length]}
              strokeDasharray="6 3"
              strokeOpacity={0.35}
              label={{
                value: `${s.tankLabel} cap`,
                position: 'insideTopRight',
                fontSize: 9,
                fill: COLOURS[i % COLOURS.length],
                fillOpacity: 0.6,
              }}
            />
          ))}

          {/* Delivery markers — vertical amber dashed lines */}
          {[...deliveryDates].map(date => (
            <ReferenceLine
              key={`del-${date}`}
              x={date}
              stroke="#f59e0b"
              strokeDasharray="4 2"
              strokeWidth={1.5}
              label={{ value: 'D', position: 'top', fontSize: 9, fill: '#f59e0b' }}
            />
          ))}

          {/* Tank lines — null values create gaps (connectNulls defaults to false) */}
          {visible.map((s, i) => (
            <Line
              key={s.tankId}
              type="monotone"
              dataKey={s.tankId}
              name={s.tankLabel}
              stroke={COLOURS[i % COLOURS.length]}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
